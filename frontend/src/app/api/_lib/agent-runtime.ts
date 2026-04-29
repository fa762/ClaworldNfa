import { ClawNFAABI } from '@/contracts/abis/ClawNFA';
import { ClawOracleActionHubViewABI } from '@/contracts/abis/ClawOracleActionHubView';
import { addresses, chainId, getBscScanAddressUrl } from '@/contracts/addresses';

import { getAutonomyStatus } from './autonomy';
import { ensureConfigured, publicClient } from './chain';
import { getMemorySummaryRuntime } from './memory';
import { getNfaDetail } from './nfas';

export const AGENT_PROTOCOLS = {
  task: '0x27c4f99113533472859c5bb20de06076029b600390706ebf7016ee2575a69c0a',
  pk: '0x8c48a1a6b0668360238d9e0abd8940194fa1d6458713a56e869643e9ea637b34',
  battleRoyale: '0xd24032ab7b57cf65aa850464772106aedcd29cf1628f7ab9e962ba506049607c',
} as const;

export type AgentSkillKey = keyof typeof AGENT_PROTOCOLS | 'finance' | 'market' | 'memory' | 'contractIntel';

type RawReceipt = Record<string, unknown> | readonly unknown[] | null | undefined;

const ACTION_KIND_LABELS: Record<number, string> = {
  0: 'task',
  1: 'pk',
  2: 'market',
  3: 'battle_royale',
};

const STATUS_LABELS: Record<number, string> = {
  0: 'none',
  1: 'requested',
  2: 'fulfilled',
  3: 'executing',
  4: 'executed',
  5: 'failed',
  6: 'expired',
  7: 'cancelled',
};

function at(raw: RawReceipt, key: string, index: number) {
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw[index];
  return (raw as Record<string, unknown>)[key];
}

function asString(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function asBigintString(value: unknown) {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
  const raw = asString(value, '0');
  return raw || '0';
}

function asNumber(value: unknown) {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIso(value: unknown) {
  const seconds = asNumber(value);
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

function clampLimit(raw: string | null, fallback = 20) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function normalizeCursor(raw: string | null) {
  if (!raw) return 0n;
  try {
    const value = BigInt(raw);
    return value < 0n ? 0n : value;
  } catch {
    return 0n;
  }
}

function publicStatus(status: number) {
  if (status === 4) return 'success';
  if (status === 5) return 'failed';
  if (status === 6) return 'expired';
  if (status === 7) return 'cancelled';
  if (status === 3) return 'executing';
  if (status === 1 || status === 2) return 'pending';
  return 'none';
}

function skillFromReceipt(actionKind: number, protocolId: string) {
  const lowerProtocol = protocolId.toLowerCase();
  const matched = Object.entries(AGENT_PROTOCOLS).find(([, value]) => value.toLowerCase() === lowerProtocol);
  if (matched) return matched[0] === 'battleRoyale' ? 'battle_royale' : matched[0];
  return ACTION_KIND_LABELS[actionKind] ?? `action_${actionKind}`;
}

function absoluteUrl(baseUrl: string | null | undefined, path: string) {
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function originFromRequest(request: Request) {
  const configuredOrigin =
    process.env.CLAWORLD_PUBLIC_ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_PUBLIC_ORIGIN ||
    '';
  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin;
    } catch {
      // Fall through to proxy-aware request headers.
    }
  }

  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const host = forwardedHost.split(',')[0]?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto') || '';
  const proto = forwardedProto.split(',')[0]?.trim().replace(/:$/, '') || '';
  if (host && host !== '0.0.0.0' && !host.startsWith('0.0.0.0:')) {
    return `${proto || 'https'}://${host}`;
  }

  const url = new URL(request.url);
  if (url.hostname === '0.0.0.0' || url.hostname === '::') {
    return 'https://clawnfaterminal.xyz';
  }
  return `${url.protocol}//${url.host}`;
}

export function parseTokenId(raw: string) {
  if (!/^\d+$/.test(raw)) {
    throw new Error('Invalid token id');
  }
  return Number(raw);
}

export function parseRequestId(raw: string) {
  if (!/^\d+$/.test(raw)) {
    throw new Error('Invalid request id');
  }
  return BigInt(raw);
}

export function parseReceiptQuery(request: Request) {
  const url = new URL(request.url);
  const protocol = url.searchParams.get('protocol') || url.searchParams.get('skill') || '';
  const normalizedProtocol = protocol === 'br' || protocol === 'battle_royale' ? 'battleRoyale' : protocol;

  return {
    cursor: normalizeCursor(url.searchParams.get('cursor')),
    limit: clampLimit(url.searchParams.get('limit')),
    protocol: Object.prototype.hasOwnProperty.call(AGENT_PROTOCOLS, normalizedProtocol)
      ? (normalizedProtocol as keyof typeof AGENT_PROTOCOLS)
      : null,
  };
}

export function normalizeReceipt(raw: RawReceipt) {
  const status = asNumber(at(raw, 'status', 5));
  const actionKind = asNumber(at(raw, 'actionKind', 2));
  const protocolId = asString(at(raw, 'protocolId', 3));

  return {
    requestId: asBigintString(at(raw, 'requestId', 0)),
    tokenId: asBigintString(at(raw, 'nfaId', 1)),
    actionKind,
    skill: skillFromReceipt(actionKind, protocolId),
    protocolId,
    spendAssetId: asString(at(raw, 'spendAssetId', 4)),
    status,
    statusLabel: STATUS_LABELS[status] ?? `status_${status}`,
    publicStatus: publicStatus(status),
    requester: asString(at(raw, 'requester', 6)),
    lastExecutor: asString(at(raw, 'lastExecutor', 7)),
    resolvedChoice: asNumber(at(raw, 'resolvedChoice', 8)),
    payloadHash: asString(at(raw, 'payloadHash', 9)),
    capabilityHash: asString(at(raw, 'capabilityHash', 10)),
    executionRef: asString(at(raw, 'executionRef', 11)),
    resultHash: asString(at(raw, 'resultHash', 12)),
    receiptHash: asString(at(raw, 'receiptHash', 13)),
    requestedSpend: asBigintString(at(raw, 'requestedSpend', 14)),
    actualSpend: asBigintString(at(raw, 'actualSpend', 15)),
    clwCredit: asBigintString(at(raw, 'clwCredit', 16)),
    xpCredit: asNumber(at(raw, 'xpCredit', 17)),
    createdAt: asBigintString(at(raw, 'createdAt', 18)),
    createdAtIso: toIso(at(raw, 'createdAt', 18)),
    executedAt: asBigintString(at(raw, 'executedAt', 19)),
    executedAtIso: toIso(at(raw, 'executedAt', 19)),
    retryCount: asNumber(at(raw, 'retryCount', 20)),
    reasoningCid: asString(at(raw, 'reasoningCid', 21), '') || null,
    lastError: asString(at(raw, 'lastError', 22), '') || null,
  };
}

export async function getLearningInfo(tokenId: number) {
  ensureConfigured(['clawNFA']);
  const id = BigInt(tokenId);
  const [root, version, updatedAt] = await Promise.all([
    publicClient.readContract({
      address: addresses.clawNFA,
      abi: ClawNFAABI,
      functionName: 'learningTreeRoot',
      args: [id],
    }),
    publicClient.readContract({
      address: addresses.clawNFA,
      abi: ClawNFAABI,
      functionName: 'learningVersion',
      args: [id],
    }),
    publicClient.readContract({
      address: addresses.clawNFA,
      abi: ClawNFAABI,
      functionName: 'lastLearningUpdate',
      args: [id],
    }),
  ]);

  return {
    root: asString(root),
    version: asBigintString(version),
    updatedAt: asBigintString(updatedAt),
    updatedAtIso: toIso(updatedAt),
  };
}

export function listAgentSkills() {
  return [
    {
      key: 'task',
      name: 'Task Mining',
      actionKind: 0,
      protocolId: AGENT_PROTOCOLS.task,
      contract: addresses.taskSkill,
      adapter: addresses.taskSkillAdapter,
      agentCallable: true,
      userCallable: true,
      summary: 'Mine tasks, receive Claworld and trait growth.',
    },
    {
      key: 'pk',
      name: 'PK Arena',
      actionKind: 1,
      protocolId: AGENT_PROTOCOLS.pk,
      contract: addresses.pkSkill,
      adapter: addresses.pkSkillAdapter,
      agentCallable: true,
      userCallable: true,
      summary: 'Create, join and settle strategy matches.',
    },
    {
      key: 'battle_royale',
      name: 'Battle Royale',
      actionKind: 3,
      protocolId: AGENT_PROTOCOLS.battleRoyale,
      contract: addresses.battleRoyale,
      adapter: addresses.battleRoyaleAdapter,
      agentCallable: true,
      userCallable: true,
      summary: 'Enter rooms, survive reveal, and claim room-based rewards.',
    },
    {
      key: 'finance',
      name: 'Ledger Finance',
      actionKind: null,
      protocolId: null,
      contract: addresses.clawRouter,
      adapter: null,
      agentCallable: false,
      userCallable: true,
      summary: 'Deposit and withdraw Claworld through the NFA ledger.',
    },
    {
      key: 'market',
      name: 'NFA Market',
      actionKind: 2,
      protocolId: null,
      contract: addresses.marketSkill,
      adapter: null,
      agentCallable: false,
      userCallable: true,
      summary: 'List, cancel and buy NFA bodies.',
    },
    {
      key: 'memory',
      name: 'CML Memory',
      actionKind: null,
      protocolId: null,
      contract: addresses.clawNFA,
      adapter: null,
      agentCallable: false,
      userCallable: true,
      summary: 'Write memory text and anchor the learning root on-chain.',
    },
    {
      key: 'contract_intel',
      name: 'BSC Contract Intelligence',
      actionKind: null,
      protocolId: null,
      contract: null,
      adapter: null,
      agentCallable: false,
      userCallable: true,
      summary: 'Analyze BSC contract addresses with backend tools.',
    },
  ];
}

export async function getAgentReceipts(
  tokenId: number,
  options: { cursor?: bigint; limit?: number; protocol?: keyof typeof AGENT_PROTOCOLS | null } = {},
) {
  ensureConfigured(['oracleActionHub']);
  const id = BigInt(tokenId);
  const cursor = options.cursor ?? 0n;
  const limit = BigInt(options.limit ?? 20);
  const result = options.protocol
    ? ((await publicClient.readContract({
        address: addresses.oracleActionHub,
        abi: ClawOracleActionHubViewABI,
        functionName: 'getActionReceiptsByProtocol',
        args: [id, AGENT_PROTOCOLS[options.protocol], cursor, limit],
      })) as readonly [readonly RawReceipt[], bigint])
    : ((await publicClient.readContract({
        address: addresses.oracleActionHub,
        abi: ClawOracleActionHubViewABI,
        functionName: 'getActionReceiptsByNfa',
        args: [id, cursor, limit],
      })) as readonly [readonly RawReceipt[], bigint]);

  return {
    tokenId: String(tokenId),
    cursor: cursor.toString(),
    nextCursor: asBigintString(result[1]),
    limit: limit.toString(),
    protocol: options.protocol ?? null,
    receipts: (result[0] ?? []).map(normalizeReceipt),
  };
}

export async function getReceiptByRequestId(requestId: bigint) {
  ensureConfigured(['oracleActionHub']);
  const raw = (await publicClient.readContract({
    address: addresses.oracleActionHub,
    abi: ClawOracleActionHubViewABI,
    functionName: 'getActionReceipt',
    args: [requestId],
  })) as RawReceipt;
  return normalizeReceipt(raw);
}

export async function buildAgentCard(tokenId: number, baseUrl?: string | null) {
  const [detail, learning, memory, autonomy, receiptPage] = await Promise.all([
    getNfaDetail(String(tokenId)),
    getLearningInfo(tokenId).catch(() => null),
    getMemorySummaryRuntime(tokenId).catch(() => null),
    getAutonomyStatus(tokenId).catch(() => null),
    getAgentReceipts(tokenId, { limit: 5 }).catch(() => null),
  ]);

  const capabilities = [
    'claw.nfa_body',
    'claw.memory_root',
    'claw.policy_execution',
    'claw.action_receipt',
    'claw.event_index',
    'claw.task_mining',
    'claw.pk_arena',
    'claw.battle_royale',
    'claw.market',
    'claw.ledger_finance',
    'claw.contract_intel',
  ];

  return {
    schemaVersion: 'claw.agent-card.v0',
    name: `ClawNFA #${tokenId}`,
    displayName: detail.displayName,
    description: 'User-owned Non-Fungible Agent body with memory roots, policy-controlled execution, skill adapters and verifiable action receipts.',
    chain: `eip155:${chainId}`,
    chainId,
    tokenId: String(tokenId),
    nfaContract: addresses.clawNFA,
    owner: detail.currentOwner,
    explorer: getBscScanAddressUrl(addresses.clawNFA),
    body: {
      level: detail.level,
      rarity: detail.rarity,
      shelter: detail.shelter,
      status: detail.statusLabel,
      ledgerBalance: detail.ledgerBalanceCLW,
      upkeepDaily: detail.upkeepDailyCLW,
      upkeepDays: detail.upkeepDays,
      personality: {
        courage: detail.personalityVector[0] ?? 0,
        wisdom: detail.personalityVector[1] ?? 0,
        social: detail.personalityVector[2] ?? 0,
        create: detail.personalityVector[3] ?? 0,
        grit: detail.personalityVector[4] ?? 0,
      },
      dna: detail.dnaTraits,
      stats: {
        tasks: detail.taskTotal,
        pkWins: detail.pkWins,
        pkLosses: detail.pkLosses,
      },
      image: detail.avatarUri,
      tokenURI: detail.tokenURI,
    },
    memory: {
      root: learning?.root ?? null,
      version: learning?.version ?? null,
      lastUpdatedAt: learning?.updatedAtIso ?? null,
      latestSnapshotHash: memory?.latestSnapshotHash ?? null,
      latestAnchorTxHash: memory?.latestAnchorTxHash ?? null,
      identity: memory?.identity ?? null,
      endpoint: absoluteUrl(baseUrl, `/api/agents/${tokenId}/memory/summary`),
    },
    policy: {
      enabled: Boolean(autonomy?.enabled),
      paused: Boolean(autonomy?.paused),
      budget: autonomy?.budget ?? null,
      directive: autonomy?.directive ?? null,
    },
    execution: {
      registry: addresses.autonomyRegistry,
      actionHub: addresses.oracleActionHub,
      defaultOperator: addresses.autonomyOperator,
      finalizationHub: addresses.autonomyFinalizationHub,
    },
    capabilities,
    skills: listAgentSkills(),
    receipts: {
      endpoint: absoluteUrl(baseUrl, `/api/agents/${tokenId}/receipts`),
      latest: receiptPage?.receipts ?? [],
    },
    events: {
      endpoint: absoluteUrl(baseUrl, `/api/agents/${tokenId}/events/summary`),
      defaultWindow: 'month',
      summary: 'Indexed Claworld ledger, skill reward, spend, upkeep and withdrawal events.',
    },
    endpoints: {
      metadata: absoluteUrl(baseUrl, `/api/agents/${tokenId}`),
      agentCard: absoluteUrl(baseUrl, `/api/agents/${tokenId}/agent-card`),
      publicAgentCard: absoluteUrl(baseUrl, `/agents/${tokenId}/agent-card.json`),
      chat: absoluteUrl(baseUrl, `/api/chat/${tokenId}/send`),
      chatHistory: absoluteUrl(baseUrl, `/api/chat/${tokenId}/history`),
      receipts: absoluteUrl(baseUrl, `/api/agents/${tokenId}/receipts`),
      eventSummary: absoluteUrl(baseUrl, `/api/agents/${tokenId}/events/summary`),
      skills: absoluteUrl(baseUrl, `/api/agents/${tokenId}/skills`),
      memorySummary: absoluteUrl(baseUrl, `/api/agents/${tokenId}/memory/summary`),
    },
    standards: {
      agentCard: 'v0',
      erc8004: 'planned-mapping',
      bap578: 'aligned-nfa-body',
      mcp: 'planned-tool-server',
      x402: 'planned-payment-gate',
      erc8183: 'planned-job-receipt-mapping',
    },
  };
}

export function buildProjectAgentCard(baseUrl?: string | null) {
  return {
    schemaVersion: 'claw.project-agent-card.v0',
    name: 'claworldnfa',
    description: 'A user-owned Non-Fungible Agent body stack on BNB Chain.',
    chain: `eip155:${chainId}`,
    chainId,
    contracts: {
      nfa: addresses.clawNFA,
      router: addresses.clawRouter,
      clwToken: addresses.clwToken,
      autonomyRegistry: addresses.autonomyRegistry,
      actionHub: addresses.oracleActionHub,
      taskSkill: addresses.taskSkill,
      pkSkill: addresses.pkSkill,
      battleRoyale: addresses.battleRoyale,
      marketSkill: addresses.marketSkill,
    },
    capabilities: [
      'claw.nfa_body',
      'claw.memory_root',
      'claw.policy_execution',
      'claw.action_receipt',
      'claw.event_index',
      'claw.skill_adapter',
      'claw.contract_intel',
    ],
    endpoints: {
      terminal: absoluteUrl(baseUrl, '/terminal'),
      nfas: absoluteUrl(baseUrl, '/api/nfas?owner={wallet}'),
      agentCard: absoluteUrl(baseUrl, '/api/agents/{tokenId}/agent-card'),
      publicAgentCard: absoluteUrl(baseUrl, '/agents/{tokenId}/agent-card.json'),
      receipts: absoluteUrl(baseUrl, '/api/agents/{tokenId}/receipts'),
      eventSummary: absoluteUrl(baseUrl, '/api/agents/{tokenId}/events/summary'),
      receipt: absoluteUrl(baseUrl, '/api/receipts/{requestId}'),
      skills: absoluteUrl(baseUrl, '/api/agents/{tokenId}/skills'),
      memorySummary: absoluteUrl(baseUrl, '/api/agents/{tokenId}/memory/summary'),
      chat: absoluteUrl(baseUrl, '/api/chat/{tokenId}/send'),
    },
    standards: {
      agentCard: 'v0',
      erc8004: 'planned-mapping',
      bap578: 'aligned-nfa-body',
      mcp: 'planned-tool-server',
      x402: 'planned-payment-gate',
      erc8183: 'planned-job-receipt-mapping',
    },
  };
}
