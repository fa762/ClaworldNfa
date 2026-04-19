import { ClawOracleActionHubViewABI } from '@/contracts/abis/ClawOracleActionHubView';
import { ClawRouterABI } from '@/contracts/abis/ClawRouter';
import { ClawAutonomyRegistryABI } from '@/contracts/abis/ClawAutonomyRegistry';
import { addresses } from '@/contracts/addresses';
import { getStoredAutonomyDirective } from '@/lib/server/autonomyDirectiveStore';

import { ensureConfigured, publicClient } from './chain';

const AUTONOMY_PROTOCOL_ID = {
  task: '0x27c4f99113533472859c5bb20de06076029b600390706ebf7016ee2575a69c0a',
  pk: '0x8c48a1a6b0668360238d9e0abd8940194fa1d6458713a56e869643e9ea637b34',
  battleRoyale: '0xd24032ab7b57cf65aa850464772106aedcd29cf1628f7ab9e962ba506049607c',
} as const;

const AUTONOMY_ACTION_KIND = {
  task: 0,
  pk: 1,
  battleRoyale: 3,
} as const;

type AgentKey = keyof typeof AUTONOMY_PROTOCOL_ID;

type RawReceipt = {
  requestId?: bigint;
  status?: number;
  actualSpend?: bigint;
  clwCredit?: bigint;
  createdAt?: bigint;
  executedAt?: bigint;
  reasoningCid?: string;
  lastError?: string;
  resolvedChoice?: number;
  executionRef?: string;
};

export type AutonomyStatusPayload = {
  enabled: boolean;
  paused: boolean;
  directive: {
    text: string;
    signedAt: string;
    expiresAt: string | null;
    skills: string[];
    onchainNonce: string | null;
  } | null;
  budget: {
    totalCLW: string;
    usedCLW: string;
    remainingCLW: string;
    windowStart: string | null;
  };
  recentActions: Array<{
    id: string;
    type: 'action_receipt';
    tokenId: string;
    author: 'system';
    createdAt: string;
    actionId: string;
    skill: string;
    status: 'pending' | 'success' | 'failed';
    txHash: string;
    blockNumber: number | null;
    summary: string;
    costCLW: string;
    rewardCLW: string | null;
    gasBNB: string | null;
    reasoningCid: string | null;
    hippocampusEntryId: string | null;
    budgetRemainingCLW: string | null;
    errorMessage: string | null;
  }>;
};

function toIso(unix: bigint | number | undefined) {
  const value = typeof unix === 'bigint' ? Number(unix) : unix;
  if (!value || value <= 0) return new Date(0).toISOString();
  return new Date(value * 1000).toISOString();
}

function receiptState(status: number | undefined): 'pending' | 'success' | 'failed' {
  if (status === 4 || status === 3) return 'success';
  if (status === 5) return 'failed';
  return 'pending';
}

function labelForAgent(agent: AgentKey) {
  if (agent === 'task') return '任务挖矿';
  if (agent === 'pk') return 'PK';
  return '大逃杀';
}

function summarizeReceipt(agent: AgentKey, receipt: RawReceipt) {
  const spend = BigInt(receipt.actualSpend ?? 0n);
  const reward = BigInt(receipt.clwCredit ?? 0n);
  if (receipt.status === 5) {
    return `${labelForAgent(agent)} 失败${receipt.lastError ? `：${receipt.lastError}` : ''}`;
  }
  if (reward > 0n && spend > 0n) {
    return `${labelForAgent(agent)} 完成，花费 ${formatClw(spend)}，回款 ${formatClw(reward)}`;
  }
  if (reward > 0n) {
    return `${labelForAgent(agent)} 完成，回款 ${formatClw(reward)}`;
  }
  if (spend > 0n) {
    return `${labelForAgent(agent)} 已执行，花费 ${formatClw(spend)}`;
  }
  return `${labelForAgent(agent)} 已执行`;
}

function formatClw(value: bigint) {
  const whole = Number(value / 10n ** 18n);
  return `${whole.toLocaleString('en-US')} Claworld`;
}

async function readPolicy(tokenId: bigint, actionKind: number) {
  const [policy, risk] = await Promise.all([
    publicClient.readContract({
      address: addresses.autonomyRegistry,
      abi: ClawAutonomyRegistryABI,
      functionName: 'getPolicy',
      args: [tokenId, actionKind],
    }),
    publicClient.readContract({
      address: addresses.autonomyRegistry,
      abi: ClawAutonomyRegistryABI,
      functionName: 'getRiskState',
      args: [tokenId, actionKind],
    }),
  ]);

  const parsedPolicy = policy as readonly [boolean, number, number, number, bigint, bigint];
  const parsedRisk = risk as readonly [boolean, number, number, number, number, bigint, bigint];

  return {
    enabled: Boolean(parsedPolicy[0]),
    windowStart: parsedPolicy[4],
    paused: Boolean(parsedRisk[0]),
  };
}

async function readReceipts(tokenId: bigint, protocolId: `0x${string}`) {
  const result = (await publicClient.readContract({
    address: addresses.oracleActionHub,
    abi: ClawOracleActionHubViewABI,
    functionName: 'getActionReceiptsByProtocol',
    args: [tokenId, protocolId, 0n, 3n],
  })) as unknown as readonly [readonly RawReceipt[], bigint];
  return result[0] ?? [];
}

export async function getAutonomyStatus(tokenId: number): Promise<AutonomyStatusPayload> {
  ensureConfigured(['autonomyRegistry', 'oracleActionHub', 'clawRouter']);
  const token = BigInt(tokenId);

  const [taskDirective, pkDirective, brDirective, routerBalance, ledger, taskPolicy, pkPolicy, brPolicy, taskReceipts, pkReceipts, brReceipts] =
    await Promise.all([
      getStoredAutonomyDirective(tokenId, AUTONOMY_ACTION_KIND.task),
      getStoredAutonomyDirective(tokenId, AUTONOMY_ACTION_KIND.pk),
      getStoredAutonomyDirective(tokenId, AUTONOMY_ACTION_KIND.battleRoyale),
      publicClient.readContract({
        address: addresses.clawRouter,
        abi: ClawRouterABI,
        functionName: 'clwBalances',
        args: [token],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: addresses.oracleActionHub,
        abi: ClawOracleActionHubViewABI,
        functionName: 'getNfaLedger',
        args: [token],
      }) as Promise<readonly [number, number, number, number, bigint, bigint, number, bigint, `0x${string}`]>,
      readPolicy(token, AUTONOMY_ACTION_KIND.task),
      readPolicy(token, AUTONOMY_ACTION_KIND.pk),
      readPolicy(token, AUTONOMY_ACTION_KIND.battleRoyale),
      readReceipts(token, AUTONOMY_PROTOCOL_ID.task),
      readReceipts(token, AUTONOMY_PROTOCOL_ID.pk),
      readReceipts(token, AUTONOMY_PROTOCOL_ID.battleRoyale),
    ]);

  const directives = [
    taskDirective ? { key: 'task' as const, record: taskDirective } : null,
    pkDirective ? { key: 'pk' as const, record: pkDirective } : null,
    brDirective ? { key: 'battleRoyale' as const, record: brDirective } : null,
  ].filter(Boolean) as Array<{ key: AgentKey; record: NonNullable<typeof taskDirective> }>;

  const latestDirective = directives.sort((left, right) => right.record.updatedAt - left.record.updatedAt)[0] ?? null;
  const enabled = taskPolicy.enabled || pkPolicy.enabled || brPolicy.enabled;
  const paused = taskPolicy.paused || pkPolicy.paused || brPolicy.paused;
  const recent = [
    ...taskReceipts.map((item) => ({ key: 'task' as const, item })),
    ...pkReceipts.map((item) => ({ key: 'pk' as const, item })),
    ...brReceipts.map((item) => ({ key: 'battleRoyale' as const, item })),
  ]
    .sort((left, right) => Number((right.item.executedAt ?? right.item.createdAt ?? 0n) - (left.item.executedAt ?? left.item.createdAt ?? 0n)))
    .slice(0, 6);

  return {
    enabled,
    paused,
    directive: latestDirective
      ? {
          text: latestDirective.record.text,
          signedAt: new Date(latestDirective.record.updatedAt).toISOString(),
          expiresAt: null,
          skills: directives.map((item) => item.key),
          onchainNonce: null,
        }
      : null,
    budget: {
      totalCLW: routerBalance.toString(),
      usedCLW: BigInt(ledger[4]).toString(),
      remainingCLW: routerBalance.toString(),
      windowStart: enabled ? toIso(taskPolicy.windowStart || pkPolicy.windowStart || brPolicy.windowStart) : null,
    },
    recentActions: recent.map(({ key, item }) => ({
      id: `${key}-${item.requestId?.toString() ?? '0'}`,
      type: 'action_receipt',
      tokenId: token.toString(),
      author: 'system',
      createdAt: toIso(item.executedAt ?? item.createdAt),
      actionId: item.requestId?.toString() ?? '0',
      skill: key === 'battleRoyale' ? 'battle_royale' : key,
      status: receiptState(item.status),
      txHash: typeof item.executionRef === 'string' ? item.executionRef : '0x',
      blockNumber: null,
      summary: summarizeReceipt(key, item),
      costCLW: BigInt(item.actualSpend ?? 0n).toString(),
      rewardCLW: BigInt(item.clwCredit ?? 0n) > 0n ? BigInt(item.clwCredit ?? 0n).toString() : null,
      gasBNB: null,
      reasoningCid: item.reasoningCid ?? null,
      hippocampusEntryId: null,
      budgetRemainingCLW: routerBalance.toString(),
      errorMessage: item.lastError ?? null,
    })),
  };
}
