import { createPublicClient, getAddress, http, type Address } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';

import { ClawNFAABI } from '@/contracts/abis/ClawNFA';
import { ClawRouterABI } from '@/contracts/abis/ClawRouter';
import { PKSkillABI } from '@/contracts/abis/PKSkill';
import { TaskSkillABI } from '@/contracts/abis/TaskSkill';
import { addresses, chainId, rpcUrl } from '@/contracts/addresses';
import { resolveIpfsUrl } from '@/lib/ipfs';
import { getLobsterName } from '@/lib/mockData';
import { getRarityName } from '@/lib/rarity';
import { getShelterName } from '@/lib/shelter';

const chain = chainId === 56 ? bsc : bscTestnet;
const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

const TRAIT_LABELS = ['勇气', '智慧', '社交', '创造', '韧性'] as const;
const NFA_ACCENTS = ['#F5A524', '#B84DFF', '#4DD4FF', '#FF6B9D', '#7FD858'] as const;

export type TerminalNFASummary = {
  tokenId: string;
  displayName: string;
  avatarUri: string;
  accentColor: string;
  level: number;
  active: boolean;
  pulse: number;
  ledgerBalanceCLW: string;
  unreadCount: number;
  shelter: string;
  statusLabel: string;
};

export type TerminalNFADetail = TerminalNFASummary & {
  rarity: string;
  personalityVector: number[];
  dnaTraits: {
    str: number;
    def: number;
    spd: number;
    vit: number;
  };
  greeting: string;
  memorySummary: string;
  tokenURI: string;
  upkeepDailyCLW: string;
  upkeepDays: number | null;
  taskTotal: number;
  pkWins: number;
  pkLosses: number;
  currentOwner: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeTokenId(rawTokenId: string) {
  if (!/^\d+$/.test(rawTokenId)) {
    throw new Error('Invalid token id');
  }
  return BigInt(rawTokenId);
}

function normalizeOwner(rawOwner: string | null) {
  if (!rawOwner) {
    throw new Error('Missing owner');
  }
  return getAddress(rawOwner);
}

function normalizeAgentMetadata(raw: unknown) {
  const value = raw as Record<string, unknown> | readonly unknown[] | null | undefined;
  return {
    persona: String((value as any)?.persona ?? (value as any)?.[0] ?? ''),
    experience: String((value as any)?.experience ?? (value as any)?.[1] ?? ''),
    voiceHash: String((value as any)?.voiceHash ?? (value as any)?.[2] ?? ''),
    animationURI: String((value as any)?.animationURI ?? (value as any)?.[3] ?? ''),
    vaultURI: String((value as any)?.vaultURI ?? (value as any)?.[4] ?? ''),
    vaultHash: String((value as any)?.vaultHash ?? (value as any)?.[5] ?? ''),
  };
}

function normalizeAgentState(raw: unknown) {
  const value = raw as Record<string, unknown> | readonly unknown[] | null | undefined;
  return {
    active: Boolean((value as any)?.active ?? (value as any)?.[1] ?? false),
    tokenOwner: String((value as any)?.tokenOwner ?? (value as any)?.[4] ?? ''),
  };
}

function normalizeLobsterState(raw: unknown) {
  const value = raw as Record<string, unknown> | readonly unknown[] | null | undefined;
  return {
    rarity: Number((value as any)?.rarity ?? (value as any)?.[0] ?? 0),
    shelter: Number((value as any)?.shelter ?? (value as any)?.[1] ?? 0),
    courage: Number((value as any)?.courage ?? (value as any)?.[2] ?? 0),
    wisdom: Number((value as any)?.wisdom ?? (value as any)?.[3] ?? 0),
    social: Number((value as any)?.social ?? (value as any)?.[4] ?? 0),
    create: Number((value as any)?.create ?? (value as any)?.[5] ?? 0),
    grit: Number((value as any)?.grit ?? (value as any)?.[6] ?? 0),
    str: Number((value as any)?.str ?? (value as any)?.[7] ?? 0),
    def: Number((value as any)?.def ?? (value as any)?.[8] ?? 0),
    spd: Number((value as any)?.spd ?? (value as any)?.[9] ?? 0),
    vit: Number((value as any)?.vit ?? (value as any)?.[10] ?? 0),
    level: Number((value as any)?.level ?? (value as any)?.[13] ?? 0),
  };
}

function normalizeTaskStats(raw: unknown) {
  const value = raw as Record<string, unknown> | readonly unknown[] | null | undefined;
  return {
    total: Number((value as any)?.total ?? (value as any)?.[0] ?? 0),
  };
}

function normalizePkStats(raw: unknown) {
  const value = raw as Record<string, unknown> | readonly unknown[] | null | undefined;
  return {
    wins: Number((value as any)?.wins ?? (value as any)?.[0] ?? 0),
    losses: Number((value as any)?.losses ?? (value as any)?.[1] ?? 0),
  };
}

function deriveAccentColor(vector: number[]) {
  if (vector.length === 0) return NFA_ACCENTS[0];
  const dominantIndex = vector.reduce((best, current, index, rows) => (current > rows[best] ? index : best), 0);
  return NFA_ACCENTS[dominantIndex] ?? NFA_ACCENTS[0];
}

function derivePulse(active: boolean, taskTotal: number, pkWins: number, pkLosses: number, upkeepDays: number | null) {
  const pkTotal = pkWins + pkLosses;
  let pulse = active ? 0.36 : 0.12;
  pulse += Math.min(taskTotal, 20) * 0.018;
  pulse += Math.min(pkTotal, 12) * 0.035;
  if (upkeepDays !== null) {
    if (upkeepDays <= 1) pulse -= 0.2;
    else if (upkeepDays <= 3) pulse -= 0.1;
  }
  return Number(clamp(pulse, 0.05, 1).toFixed(2));
}

function deriveStatusLabel(active: boolean, upkeepDays: number | null) {
  if (!active) return '需要维护';
  if (upkeepDays !== null && upkeepDays <= 1) return '储备告急';
  if (upkeepDays !== null && upkeepDays <= 3) return '储备预警';
  return '稳定';
}

function deriveGreeting(displayName: string, dominantLabel: string, taskTotal: number, pkWins: number, pkLosses: number, upkeepDays: number | null) {
  if (upkeepDays !== null && upkeepDays <= 1) {
    return `${displayName} 的储备快见底了。先补储备，再继续行动。`;
  }

  if (pkWins + pkLosses > 0) {
    return `${displayName} 最近盯着竞技场。当前主线是${dominantLabel}，战绩 ${pkWins}胜/${pkLosses}败。`;
  }

  if (taskTotal > 0) {
    return `${displayName} 已经完成 ${taskTotal} 次任务，当前最明显的成长线是${dominantLabel}。`;
  }

  return `${displayName} 已接入终端。当前最明显的性格倾向是${dominantLabel}。`;
}

function deriveMemorySummary(dominantLabel: string, taskTotal: number, pkWins: number, pkLosses: number) {
  if (pkWins + pkLosses > 0) {
    return `最近可见记忆集中在竞技。它会优先记住胜败、策略和对手，当前更偏向${dominantLabel}。`;
  }

  if (taskTotal > 0) {
    return `最近可见记忆集中在成长和任务。当前主线是${dominantLabel}，已累计 ${taskTotal} 次任务。`;
  }

  return `这只 NFA 的可见记忆还很浅，当前先按${dominantLabel}主导的链上状态组织对话。`;
}

function buildSummary(
  tokenId: bigint,
  lobster: ReturnType<typeof normalizeLobsterState>,
  agentState: ReturnType<typeof normalizeAgentState>,
  metadata: ReturnType<typeof normalizeAgentMetadata>,
  routerClwBalance: bigint,
  dailyCost: bigint,
  taskStats: ReturnType<typeof normalizeTaskStats>,
  pkStats: ReturnType<typeof normalizePkStats>,
) {
  const upkeepDays = dailyCost > 0n ? Number(routerClwBalance / dailyCost) : null;
  const vector = [lobster.courage, lobster.wisdom, lobster.social, lobster.create, lobster.grit];
  const dominantIndex = vector.reduce((best, current, index, rows) => (current > rows[best] ? index : best), 0);

  return {
    tokenId: tokenId.toString(),
    displayName: getLobsterName(Number(tokenId)),
    avatarUri: resolveIpfsUrl(metadata.vaultURI),
    accentColor: deriveAccentColor(vector),
    level: lobster.level,
    active: agentState.active,
    pulse: derivePulse(agentState.active, taskStats.total, pkStats.wins, pkStats.losses, upkeepDays),
    ledgerBalanceCLW: routerClwBalance.toString(),
    unreadCount: 0,
    shelter: getShelterName(lobster.shelter),
    statusLabel: deriveStatusLabel(agentState.active, upkeepDays),
    upkeepDays,
    dominantLabel: TRAIT_LABELS[dominantIndex] ?? '勇气',
  };
}

async function readNfaCore(tokenId: bigint) {
  const [agentMetadataRaw, agentStateRaw, lobsterStateRaw, routerClwBalanceRaw, dailyCostRaw, taskStatsRaw, pkStatsRaw] = await Promise.all([
    publicClient.readContract({
      address: addresses.clawNFA as Address,
      abi: ClawNFAABI,
      functionName: 'getAgentMetadata',
      args: [tokenId],
    }),
    publicClient.readContract({
      address: addresses.clawNFA as Address,
      abi: ClawNFAABI,
      functionName: 'getAgentState',
      args: [tokenId],
    }),
    publicClient.readContract({
      address: addresses.clawRouter as Address,
      abi: ClawRouterABI,
      functionName: 'getLobsterState',
      args: [tokenId],
    }),
    publicClient.readContract({
      address: addresses.clawRouter as Address,
      abi: ClawRouterABI,
      functionName: 'clwBalances',
      args: [tokenId],
    }),
    publicClient.readContract({
      address: addresses.clawRouter as Address,
      abi: ClawRouterABI,
      functionName: 'getDailyCost',
      args: [tokenId],
    }),
    publicClient.readContract({
      address: addresses.taskSkill as Address,
      abi: TaskSkillABI,
      functionName: 'getTaskStats',
      args: [tokenId],
    }),
    publicClient.readContract({
      address: addresses.pkSkill as Address,
      abi: PKSkillABI,
      functionName: 'getPkStats',
      args: [tokenId],
    }),
  ]);

  const metadataTuple = Array.isArray(agentMetadataRaw) ? agentMetadataRaw[0] : agentMetadataRaw;
  const tokenURI = Array.isArray(agentMetadataRaw) ? String(agentMetadataRaw[1] ?? '') : '';
  const metadata = normalizeAgentMetadata(metadataTuple);
  const agentState = normalizeAgentState(agentStateRaw);
  const lobster = normalizeLobsterState(lobsterStateRaw);
  const routerClwBalance = BigInt(routerClwBalanceRaw as bigint);
  const dailyCost = BigInt(dailyCostRaw as bigint);
  const taskStats = normalizeTaskStats(taskStatsRaw);
  const pkStats = normalizePkStats(pkStatsRaw);
  const summary = buildSummary(tokenId, lobster, agentState, metadata, routerClwBalance, dailyCost, taskStats, pkStats);

  return {
    tokenId,
    tokenURI,
    metadata,
    agentState,
    lobster,
    routerClwBalance,
    dailyCost,
    taskStats,
    pkStats,
    summary,
  };
}

function validateConfiguredAddresses() {
  const required = [
    addresses.clawNFA,
    addresses.clawRouter,
    addresses.taskSkill,
    addresses.pkSkill,
  ];
  if (required.some((value) => !value)) {
    throw new Error('One or more main contract addresses are not configured.');
  }
}

export async function listOwnedNfas(rawOwner: string) {
  validateConfiguredAddresses();
  const owner = normalizeOwner(rawOwner);
  const tokenIds = (await publicClient.readContract({
    address: addresses.clawNFA as Address,
    abi: ClawNFAABI,
    functionName: 'tokensOfOwner',
    args: [owner],
  })) as readonly bigint[];

  const rows = await Promise.all(tokenIds.map((tokenId) => readNfaCore(tokenId)));

  return rows.map((row) => {
    const { upkeepDays, dominantLabel, ...summary } = row.summary;
    void upkeepDays;
    void dominantLabel;
    return summary satisfies TerminalNFASummary;
  });
}

export async function getNfaDetail(rawTokenId: string, rawOwner?: string | null): Promise<TerminalNFADetail> {
  validateConfiguredAddresses();
  const tokenId = normalizeTokenId(rawTokenId);
  const owner = rawOwner ? normalizeOwner(rawOwner) : null;
  const row = await readNfaCore(tokenId);

  if (owner && getAddress(row.agentState.tokenOwner) !== owner) {
    throw new Error('Requested NFA does not belong to this owner.');
  }

  const { upkeepDays, dominantLabel, ...summary } = row.summary;
  const detail: TerminalNFADetail = {
    ...summary,
    rarity: getRarityName(row.lobster.rarity, true),
    shelter: getShelterName(row.lobster.shelter),
    personalityVector: [row.lobster.courage, row.lobster.wisdom, row.lobster.social, row.lobster.create, row.lobster.grit],
    dnaTraits: {
      str: row.lobster.str,
      def: row.lobster.def,
      spd: row.lobster.spd,
      vit: row.lobster.vit,
    },
    greeting: deriveGreeting(summary.displayName, dominantLabel, row.taskStats.total, row.pkStats.wins, row.pkStats.losses, upkeepDays),
    memorySummary: deriveMemorySummary(dominantLabel, row.taskStats.total, row.pkStats.wins, row.pkStats.losses),
    tokenURI: row.tokenURI,
    upkeepDailyCLW: row.dailyCost.toString(),
    upkeepDays,
    taskTotal: row.taskStats.total,
    pkWins: row.pkStats.wins,
    pkLosses: row.pkStats.losses,
    currentOwner: row.agentState.tokenOwner,
  };

  return detail;
}
