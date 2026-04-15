'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Hammer,
  Shield,
  Sparkles,
  Swords,
  TimerReset,
  X,
} from 'lucide-react';
import { decodeEventLog, parseEther, type Address } from 'viem';
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';

import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { WalletGate } from '@/components/wallet/WalletGate';
import { TaskSkillABI } from '@/contracts/abis/TaskSkill';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import { useRewardMultiplier } from '@/contracts/hooks/useWorldState';
import { formatBasisPoints, formatBNB, formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type TaskTone = 'cw-card--ready' | 'cw-card--watch' | 'cw-card--safe' | 'cw-card--warning';
type SheetMode = 'preview' | 'confirm';

type TaskTemplate = {
  key: string;
  title: string;
  summary?: string;
  taskType: number;
  xpReward: number;
  requestedClw: bigint;
  score: number;
  detail: string;
  icon: typeof Sparkles;
  tone: TaskTone;
};

type TaskPreview = {
  matchScore: number;
  actualClw: bigint;
  streakMul: bigint;
  worldMul: bigint;
  cooldownReady: boolean;
  personalityDrift: boolean;
};

type TaskResult = {
  taskTitle: string;
  taskType: number;
  requestedClw: bigint;
  actualClw: bigint;
  xpReward: number;
  matchScore: number;
  txHash: `0x${string}`;
  driftState: 'applied' | 'skipped' | 'none';
  driftReason?: string;
};

type TaskCopy = {
  zh: string;
  en: string;
};

type TaskVariant = {
  title: TaskCopy;
  summary: TaskCopy;
  detail: TaskCopy;
  rewardBias: number;
  xpBias: number;
};

const taskSkillContract = {
  address: addresses.taskSkill,
  abi: TaskSkillABI,
} as const;

const taskPreviewStateAbi = [
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'lastTaskType',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'sameTypeStreak',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const TASK_VARIANTS = {
  adventure: [
    {
      title: { zh: '废墟探索', en: 'Ruins sweep' },
      summary: { zh: '清掉地表废墟，带回还能卖钱的残件。', en: 'Sweep the ruins and bring back salvage worth selling.' },
      detail: { zh: '高回报', en: 'High upside' },
      rewardBias: 1.06,
      xpBias: 2,
    },
    {
      title: { zh: '信号塔抢修', en: 'Signal rush' },
      summary: { zh: '抢在风暴前修好信号塔，报酬高，风险也高。', en: 'Repair the signal tower before the storm closes in.' },
      detail: { zh: '高风险', en: 'High risk' },
      rewardBias: 1.1,
      xpBias: 1,
    },
    {
      title: { zh: '护送幸存者', en: 'Escort run' },
      summary: { zh: '带新来的幸存者穿过地道，路上容易遭遇意外。', en: 'Escort survivors through the tunnels under pressure.' },
      detail: { zh: '稳中带赚', en: 'Solid payout' },
      rewardBias: 1,
      xpBias: 0,
    },
    {
      title: { zh: '巢穴清扫', en: 'Nest purge' },
      summary: { zh: '清掉洞穴里的危险生物，顺手回收稀有材料。', en: 'Clear a nest and salvage rare materials.' },
      detail: { zh: '刺激', en: 'Spiky' },
      rewardBias: 1.04,
      xpBias: -1,
    },
    {
      title: { zh: '地表突袭', en: 'Surface raid' },
      summary: { zh: '趁监控盲区冲上地表，抢一波就撤。', en: 'Hit the surface fast and get out before the window closes.' },
      detail: { zh: '爆发', en: 'Burst' },
      rewardBias: 1.08,
      xpBias: 0,
    },
  ] satisfies TaskVariant[],
  puzzle: [
    {
      title: { zh: '密码破译', en: 'Cipher break' },
      summary: { zh: '拆开一段加密通信，看看对面在准备什么。', en: 'Break an encrypted message and read the intent behind it.' },
      detail: { zh: '偏稳定', en: 'Steady' },
      rewardBias: 1,
      xpBias: 2,
    },
    {
      title: { zh: '数据分析', en: 'Data sort' },
      summary: { zh: '把旧服务器里的碎片数据整理成可用情报。', en: 'Turn broken server scraps into usable intel.' },
      detail: { zh: '高经验', en: 'XP heavy' },
      rewardBias: 0.96,
      xpBias: 3,
    },
    {
      title: { zh: '终端诊断', en: 'Terminal scan' },
      summary: { zh: '找出异常终端的故障点，顺手抄走里面的资料。', en: 'Diagnose a rogue terminal and copy anything useful.' },
      detail: { zh: '低波动', en: 'Low swing' },
      rewardBias: 0.94,
      xpBias: 1,
    },
    {
      title: { zh: '路径规划', en: 'Route plan' },
      summary: { zh: '算出一条避开传感器的安全路线，卖给需要的人。', en: 'Chart a sensor-safe route and sell the route intel.' },
      detail: { zh: '稳健', en: 'Reliable' },
      rewardBias: 1.02,
      xpBias: 0,
    },
    {
      title: { zh: '文献翻译', en: 'Archive decode' },
      summary: { zh: '把旧世界手册翻出来，挖点今天还能用的知识。', en: 'Decode an old-world manual for present-day use.' },
      detail: { zh: '成长向', en: 'Growth' },
      rewardBias: 0.92,
      xpBias: 4,
    },
  ] satisfies TaskVariant[],
  crafting: [
    {
      title: { zh: '终端改装', en: 'Terminal mod' },
      summary: { zh: '改一台旧终端，让它继续给避难所赚钱。', en: 'Refit an old terminal and put it back to work.' },
      detail: { zh: '平衡', en: 'Balanced' },
      rewardBias: 1,
      xpBias: 1,
    },
    {
      title: { zh: '能源改造', en: 'Power splice' },
      summary: { zh: '把废旧供电系统改出更高效率，省下一大笔。', en: 'Splice the power grid into a more efficient setup.' },
      detail: { zh: '保储备', en: 'Reserve' },
      rewardBias: 0.98,
      xpBias: 2,
    },
    {
      title: { zh: '防线工事', en: 'Fortify line' },
      summary: { zh: '拿废料做临时防线，顺手把能卖的零件留下。', en: 'Build fortifications and keep the sellable scraps.' },
      detail: { zh: '稳赚', en: 'Steady gain' },
      rewardBias: 1.03,
      xpBias: 0,
    },
    {
      title: { zh: '通信加密', en: 'Signal harden' },
      summary: { zh: '重做一套通信加密方案，让外面更难摸进来。', en: 'Rework comms encryption to keep outsiders out.' },
      detail: { zh: '成长向', en: 'Growth' },
      rewardBias: 0.95,
      xpBias: 3,
    },
    {
      title: { zh: '地图绘制', en: 'Tunnel map' },
      summary: { zh: '把散乱的探索记录画成地图，后面进出都能省成本。', en: 'Turn scattered exploration notes into a usable map.' },
      detail: { zh: '低风险', en: 'Low risk' },
      rewardBias: 0.97,
      xpBias: 1,
    },
  ] satisfies TaskVariant[],
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pickSeededVariant<T>(items: readonly T[], seed: number) {
  if (items.length === 0) throw new Error('Task variant pool is empty.');
  return items[Math.abs(seed) % items.length];
}

function getTaskTraitLabel(taskType: number, pick: <T,>(zh: T, en: T) => T) {
  if (taskType === 0) return pick('勇气', 'Courage');
  if (taskType === 1) return pick('智慧', 'Wisdom');
  if (taskType === 2) return pick('社交', 'Social');
  if (taskType === 3) return pick('创造', 'Create');
  return pick('韧性', 'Grit');
}

function getTaskMatchValue(
  taskType: number,
  traits: {
    courage: number;
    wisdom: number;
    social: number;
    create: number;
    grit: number;
  },
) {
  if (taskType === 0) return traits.courage;
  if (taskType === 1) return traits.wisdom;
  if (taskType === 2) return traits.social;
  if (taskType === 3) return traits.create;
  return traits.grit;
}

function getErrorMessage(error: unknown, pick: <T,>(zh: T, en: T) => T) {
  if (!(error instanceof Error)) return pick('任务提交失败', 'Task transaction failed.');
  if (error.message.includes('previewTypedTaskOutcome')) {
    return pick('链上预览失败，请重试或换一个任务。', 'Preview reverted. Retry or choose another task.');
  }
  if (error.message.includes('Cooldown active')) return pick('任务还在冷却', 'Task cooldown is still active.');
  if (error.message.includes('Not NFA owner')) return pick('当前钱包不是持有人', 'Connected wallet does not own this lobster.');
  if (error.message.includes('XP cap exceeded')) return pick('XP 超过上限', 'XP reward exceeds the current TaskSkill cap.');
  if (error.message.includes('CLW cap exceeded')) return pick('奖励超过上限', 'Requested Claworld reward exceeds the current TaskSkill cap.');
  if (error.message.includes('Monthly cap exceeded')) return pick('本月性格漂移已到上限', 'Monthly personality drift cap reached.');
  if (error.message.includes('User rejected')) return pick('钱包拒绝签名', 'Wallet signature was rejected.');
  return error.message;
}

function normalizeTaskErrorMessage(error: unknown, pick: <T,>(zh: T, en: T) => T) {
  const raw = getErrorMessage(error, pick);
  if (raw.includes('previewTypedTaskOutcome')) return pick('链上预览不可用，已改用本地估算。', 'On-chain preview is unavailable. Using local estimate.');
  if (raw.includes('OKX Wallet Reject') || raw.includes('User rejected')) return pick('钱包取消了这次签名。', 'Wallet signature was cancelled.');
  if (raw.includes('execution reverted: 0x')) return pick('当前主网手动挖矿链路不可用，需要先修 TaskSkill 主网实现。', 'Manual mining is unavailable on mainnet.');
  return raw;
}

function formatRemaining(seconds: number, pick: <T,>(zh: T, en: T) => T) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) return pick(`${hours}小时 ${minutes}分`, `${hours}h ${minutes}m`);
  if (minutes > 0) return pick(`${minutes}分 ${secs}秒`, `${minutes}m ${secs}s`);
  return pick(`${secs}秒`, `${secs}s`);
}

function buildTaskTemplates(
  traits: {
    courage: number;
    wisdom: number;
    social: number;
    create: number;
    grit: number;
  },
  level: number,
  upkeepPressure: number,
  active: boolean,
  upkeepDays: number | null,
  pick: <T,>(zh: T, en: T) => T,
  tokenNumber: number,
  rollNonce: number,
) {
  const levelLift = level * 2;
  const adventureVariant = pickSeededVariant(TASK_VARIANTS.adventure, tokenNumber * 11 + rollNonce * 5 + 1);
  const puzzleVariant = pickSeededVariant(TASK_VARIANTS.puzzle, tokenNumber * 13 + rollNonce * 7 + 2);
  const craftingVariant = pickSeededVariant(TASK_VARIANTS.crafting, tokenNumber * 17 + rollNonce * 11 + 3);
  const adventureReward = clamp(
    Math.round((34 + traits.courage * 0.32 + traits.grit * 0.14 + level * 1.8) * adventureVariant.rewardBias),
    55,
    90,
  );
  const puzzleReward = clamp(
    Math.round((30 + traits.wisdom * 0.26 + traits.create * 0.12 + level * 1.6) * puzzleVariant.rewardBias),
    45,
    75,
  );
  const craftingReward = clamp(
    Math.round((32 + traits.create * 0.28 + traits.social * 0.14 + level * 1.6) * craftingVariant.rewardBias),
    50,
    80,
  );

  return [
    {
      key: 'adventure',
      title: pick('废墟探索', 'Ruins sweep'),
      taskType: 0,
      xpReward: clamp(16 + level * 2, 12, 32),
      requestedClw: parseEther(String(adventureReward)),
      score: clamp(
        Math.round(traits.courage * 0.62 + traits.grit * 0.36 + levelLift - upkeepPressure * 0.25),
        8,
        99,
      ),
      detail: pick('高回报', 'High upside'),
      icon: Swords,
      tone: active ? 'cw-card--ready' : 'cw-card--warning',
    },
    {
      key: 'puzzle',
      title: pick('密码破译', 'Cipher break'),
      taskType: 1,
      xpReward: clamp(14 + level * 2, 12, 30),
      requestedClw: parseEther(String(puzzleReward)),
      score: clamp(
        Math.round(traits.wisdom * 0.7 + traits.create * 0.18 + levelLift - upkeepPressure * 0.16),
        8,
        99,
      ),
      detail: pick('偏稳定', 'Steady'),
      icon: Shield,
      tone: 'cw-card--watch',
    },
    {
      key: 'crafting',
      title: pick('终端改装', 'Terminal mod'),
      taskType: 3,
      xpReward: clamp(12 + level * 2, 10, 28),
      requestedClw: parseEther(String(craftingReward)),
      score: clamp(
        Math.round(traits.create * 0.58 + traits.social * 0.22 + levelLift - upkeepPressure * 0.1),
        8,
        99,
      ),
      detail: upkeepDays !== null && upkeepDays <= 2 ? pick('保储备', 'Low risk') : pick('平衡', 'Balanced'),
      icon: Hammer,
      tone: upkeepDays !== null && upkeepDays <= 2 ? 'cw-card--warning' : 'cw-card--safe',
    },
  ] satisfies TaskTemplate[];
}

function buildRolledTaskTemplates(
  traits: {
    courage: number;
    wisdom: number;
    social: number;
    create: number;
    grit: number;
  },
  level: number,
  upkeepPressure: number,
  active: boolean,
  upkeepDays: number | null,
  pick: <T,>(zh: T, en: T) => T,
  tokenNumber: number,
  rollNonce: number,
) {
  const levelLift = level * 2;
  const adventureVariant = pickSeededVariant(TASK_VARIANTS.adventure, tokenNumber * 11 + rollNonce * 5 + 1);
  const puzzleVariant = pickSeededVariant(TASK_VARIANTS.puzzle, tokenNumber * 13 + rollNonce * 7 + 2);
  const craftingVariant = pickSeededVariant(TASK_VARIANTS.crafting, tokenNumber * 17 + rollNonce * 11 + 3);

  const adventureReward = clamp(
    Math.round((34 + traits.courage * 0.32 + traits.grit * 0.14 + level * 1.8) * adventureVariant.rewardBias),
    55,
    90,
  );
  const puzzleReward = clamp(
    Math.round((30 + traits.wisdom * 0.26 + traits.create * 0.12 + level * 1.6) * puzzleVariant.rewardBias),
    45,
    75,
  );
  const craftingReward = clamp(
    Math.round((32 + traits.create * 0.28 + traits.social * 0.14 + level * 1.6) * craftingVariant.rewardBias),
    50,
    80,
  );

  return [
    {
      key: 'adventure',
      title: pick(adventureVariant.title.zh, adventureVariant.title.en),
      summary: pick(adventureVariant.summary.zh, adventureVariant.summary.en),
      taskType: 0,
      xpReward: clamp(16 + level * 2 + adventureVariant.xpBias, 12, 32),
      requestedClw: parseEther(String(adventureReward)),
      score: clamp(
        Math.round(traits.courage * 0.62 + traits.grit * 0.36 + levelLift - upkeepPressure * 0.25),
        8,
        99,
      ),
      detail: pick(adventureVariant.detail.zh, adventureVariant.detail.en),
      icon: Swords,
      tone: active ? 'cw-card--ready' : 'cw-card--warning',
    },
    {
      key: 'puzzle',
      title: pick(puzzleVariant.title.zh, puzzleVariant.title.en),
      summary: pick(puzzleVariant.summary.zh, puzzleVariant.summary.en),
      taskType: 1,
      xpReward: clamp(14 + level * 2 + puzzleVariant.xpBias, 12, 30),
      requestedClw: parseEther(String(puzzleReward)),
      score: clamp(
        Math.round(traits.wisdom * 0.7 + traits.create * 0.18 + levelLift - upkeepPressure * 0.16),
        8,
        99,
      ),
      detail: pick(puzzleVariant.detail.zh, puzzleVariant.detail.en),
      icon: Shield,
      tone: 'cw-card--watch',
    },
    {
      key: 'crafting',
      title: pick(craftingVariant.title.zh, craftingVariant.title.en),
      summary: pick(craftingVariant.summary.zh, craftingVariant.summary.en),
      taskType: 3,
      xpReward: clamp(12 + level * 2 + craftingVariant.xpBias, 10, 28),
      requestedClw: parseEther(String(craftingReward)),
      score: clamp(
        Math.round(traits.create * 0.58 + traits.social * 0.22 + levelLift - upkeepPressure * 0.1),
        8,
        99,
      ),
      detail:
        upkeepDays !== null && upkeepDays <= 2
          ? pick('保储备', 'Low risk')
          : pick(craftingVariant.detail.zh, craftingVariant.detail.en),
      icon: Hammer,
      tone: upkeepDays !== null && upkeepDays <= 2 ? 'cw-card--warning' : 'cw-card--safe',
    },
  ] satisfies TaskTemplate[];
}

export default function PlayPage() {
  const { pick } = useI18n();
  const companion = useActiveCompanion();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainPreviewEnabled = false;
  const { data: hash, error, isPending, writeContractAsync } = useWriteContract();
  const receiptQuery = useWaitForTransactionReceipt({ hash });

  const [selectedTaskKey, setSelectedTaskKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>('preview');
  const [gasUnits, setGasUnits] = useState<bigint | null>(null);
  const [gasCostWei, setGasCostWei] = useState<bigint | null>(null);
  const [gasEstimateError, setGasEstimateError] = useState<string | null>(null);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [submittedTask, setSubmittedTask] = useState<TaskTemplate | null>(null);
  const [submittedPreview, setSubmittedPreview] = useState<TaskPreview | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [awaitingWallet, setAwaitingWallet] = useState(false);
  const [refreshingPreview, setRefreshingPreview] = useState(false);
  const [taskRollNonce, setTaskRollNonce] = useState(0);

  const upkeepPressure =
    companion.upkeepDays === null ? 0 : clamp(100 - companion.upkeepDays * 12, 0, 42);
  const taskTemplates = useMemo(
    () =>
      buildRolledTaskTemplates(
        companion.traits,
        companion.level,
        upkeepPressure,
        companion.active,
        companion.upkeepDays,
        pick,
        companion.tokenNumber,
        taskRollNonce,
      ),
    [companion.active, companion.level, companion.tokenNumber, companion.traits, companion.upkeepDays, upkeepPressure, pick, taskRollNonce],
  );

  const rankedTaskTemplates = useMemo(
    () => [...taskTemplates].sort((left, right) => right.score - left.score),
    [taskTemplates],
  );

  const topTask = rankedTaskTemplates[0];

  useEffect(() => {
    if (!topTask) return;
    setSelectedTaskKey((current) => {
      if (current && rankedTaskTemplates.some((task) => task.key === current)) return current;
      return topTask.key;
    });
  }, [rankedTaskTemplates, topTask]);

  useEffect(() => {
    setSheetOpen(false);
    setSheetMode('preview');
    setResult(null);
    setSubmittedTask(null);
    setSubmittedPreview(null);
    setTaskRollNonce(0);
  }, [companion.tokenId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const selectedTask = rankedTaskTemplates.find((task) => task.key === selectedTaskKey) ?? topTask;
  const selectedTaskTraitLabel = selectedTask ? getTaskTraitLabel(selectedTask.taskType, pick) : null;
  const rewardMultiplierQuery = useRewardMultiplier();

  const previewQuery = useReadContract({
    ...taskSkillContract,
    functionName: 'previewTypedTaskOutcome',
    args:
      companion.hasToken && selectedTask
        ? [companion.tokenId, selectedTask.taskType, selectedTask.xpReward, selectedTask.requestedClw]
        : undefined,
    query: { enabled: chainPreviewEnabled && companion.hasToken && sheetOpen && Boolean(selectedTask) },
  });

  const lastTaskTimeQuery = useReadContract({
    ...taskSkillContract,
    functionName: 'lastTaskTime',
    args: companion.hasToken ? [companion.tokenId] : undefined,
    query: { enabled: companion.hasToken && sheetOpen },
  });

  const lastTaskTypeQuery = useReadContract({
    address: addresses.taskSkill,
    abi: taskPreviewStateAbi,
    functionName: 'lastTaskType',
    args: companion.hasToken ? [companion.tokenId] : undefined,
    query: { enabled: companion.hasToken && sheetOpen },
  });

  const sameTypeStreakQuery = useReadContract({
    address: addresses.taskSkill,
    abi: taskPreviewStateAbi,
    functionName: 'sameTypeStreak',
    args: companion.hasToken ? [companion.tokenId] : undefined,
    query: { enabled: companion.hasToken && sheetOpen },
  });

  const chainPreview = useMemo(() => {
    const data = previewQuery.data as
      | readonly [number, bigint, bigint, bigint, boolean, boolean]
      | undefined;
    if (!data) return null;
    return {
      matchScore: Number(data[0] ?? 0),
      actualClw: BigInt(data[1] ?? 0n),
      streakMul: BigInt(data[2] ?? 0n),
      worldMul: BigInt(data[3] ?? 0n),
      cooldownReady: Boolean(data[4]),
      personalityDrift: Boolean(data[5]),
    } satisfies TaskPreview;
  }, [previewQuery.data]);

  const lastTaskTime = Number(lastTaskTimeQuery.data?.toString() ?? '0');
  const cooldownEndsAt = lastTaskTime > 0 ? lastTaskTime + 4 * 60 * 60 : 0;
  const cooldownRemaining = Math.max(0, cooldownEndsAt - now);
  const lastTaskType = Number((lastTaskTypeQuery.data as number | bigint | undefined) ?? 255);
  const sameTypeStreak = Number((sameTypeStreakQuery.data as number | bigint | undefined) ?? 0);
  const rewardMultiplier = BigInt((rewardMultiplierQuery.data as bigint | undefined) ?? 10000n);
  const localPreview = useMemo(() => {
    if (!selectedTask) return null;

    const matchValue = getTaskMatchValue(selectedTask.taskType, companion.traits);
    const matchScore = clamp(matchValue * 200, 0, 20000);
    const nextStreak =
      sameTypeStreak > 0 && lastTaskType === selectedTask.taskType
        ? sameTypeStreak + 1
        : 1;

    let streakMul = 10000n;
    if (nextStreak === 2) streakMul = 8000n;
    else if (nextStreak === 3) streakMul = 6000n;
    else if (nextStreak >= 4) streakMul = 5000n;

    const actualClw =
      (selectedTask.requestedClw * BigInt(matchScore) * rewardMultiplier * streakMul) /
      10000n /
      10000n /
      10000n;

    return {
      matchScore,
      actualClw,
      streakMul,
      worldMul: rewardMultiplier,
      cooldownReady: cooldownRemaining === 0,
      personalityDrift: matchScore >= 10000,
    } satisfies TaskPreview;
  }, [selectedTask, companion.traits, sameTypeStreak, lastTaskType, rewardMultiplier, cooldownRemaining]);

  const preview = chainPreview ?? localPreview;
  const effectiveCooldownReady = preview?.cooldownReady ?? cooldownRemaining === 0;
  const previewLoading =
    !preview &&
    (previewQuery.isLoading ||
      lastTaskTimeQuery.isLoading ||
      lastTaskTypeQuery.isLoading ||
      sameTypeStreakQuery.isLoading ||
      rewardMultiplierQuery.isLoading);
  const previewReadError =
    lastTaskTimeQuery.error ??
    lastTaskTypeQuery.error ??
    sameTypeStreakQuery.error ??
    rewardMultiplierQuery.error;
  const previewFallbackNote =
    !chainPreviewEnabled && localPreview
      ? pick('链上预览不可用，已切换本地估算。', 'On-chain preview is unavailable. Using a local estimate.')
      : null;
  const previewNeedsRetry = !preview && Boolean(previewReadError);
  const previewRefreshing =
    refreshingPreview ||
    (chainPreviewEnabled && previewQuery.isRefetching) ||
    lastTaskTimeQuery.isRefetching ||
    lastTaskTypeQuery.isRefetching ||
    sameTypeStreakQuery.isRefetching;
  const previewUnavailable = !previewLoading && !preview && Boolean(previewReadError);

  useEffect(() => {
    let cancelled = false;

    async function estimateGas() {
      if (
        !publicClient ||
        !address ||
        !companion.hasToken ||
        !selectedTask ||
        !preview ||
        !effectiveCooldownReady ||
        !sheetOpen
      ) {
        setGasUnits(null);
        setGasCostWei(null);
        setGasEstimateError(null);
        return;
      }

      try {
        const [estimated, gasPrice] = await Promise.all([
          publicClient.estimateContractGas({
            ...taskSkillContract,
            functionName: 'ownerCompleteTypedTask',
            args: [
              companion.tokenId,
              selectedTask.taskType,
              selectedTask.xpReward,
              selectedTask.requestedClw,
              preview.matchScore,
            ],
            account: address as Address,
          }),
          publicClient.getGasPrice(),
        ]);

        if (!cancelled) {
          setGasUnits(estimated);
          setGasCostWei(estimated * gasPrice);
          setGasEstimateError(null);
        }
      } catch (estimateFailure) {
        if (!cancelled) {
          setGasUnits(null);
          setGasCostWei(null);
          setGasEstimateError(normalizeTaskErrorMessage(estimateFailure, pick));
        }
      }
    }

    void estimateGas();
    return () => {
      cancelled = true;
    };
  }, [address, companion.hasToken, companion.tokenId, effectiveCooldownReady, pick, preview, publicClient, selectedTask, sheetOpen]);

  useEffect(() => {
    if (!receiptQuery.data || !hash || !submittedTask) return;

    let actualClw = submittedPreview?.actualClw ?? submittedTask.requestedClw;
    let matchScore = submittedPreview?.matchScore ?? 0;
    let driftState: TaskResult['driftState'] = 'none';
    let driftReason: string | undefined;

    for (const log of receiptQuery.data.logs) {
      if (log.address.toLowerCase() !== addresses.taskSkill.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: TaskSkillABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'TaskCompleted') {
          actualClw = BigInt(decoded.args.actualClw ?? actualClw);
          matchScore = Number(decoded.args.matchScore ?? matchScore);
        }
        if (decoded.eventName === 'TaskPersonalityDrift') {
          driftState = 'applied';
        }
        if (decoded.eventName === 'TaskPersonalityDriftSkipped') {
          driftState = 'skipped';
          driftReason = decoded.args.reason;
        }
      } catch {
        continue;
      }
    }

    setResult({
      taskTitle: submittedTask.title,
      taskType: submittedTask.taskType,
      requestedClw: submittedTask.requestedClw,
      actualClw,
      xpReward: submittedTask.xpReward,
      matchScore,
      txHash: hash,
      driftState,
      driftReason,
    });
    setTaskRollNonce((current) => current + 1);
    setSheetOpen(false);
    setSheetMode('preview');
    setSubmittedTask(null);
    setSubmittedPreview(null);
  }, [hash, receiptQuery.data, submittedPreview, submittedTask]);

  const canExecute =
    companion.hasToken &&
    companion.active &&
    Boolean(selectedTask) &&
    Boolean(preview) &&
    effectiveCooldownReady &&
    Boolean(address) &&
    !gasEstimateError;

  const taskPulse = error
    ? {
        tone: 'cw-panel--cool',
        chip: pick('失败', 'Failed'),
        chipTone: 'cw-chip--alert',
        title: pick('任务提交失败', 'Task request failed'),
        detail: normalizeTaskErrorMessage(error, pick),
      }
    : awaitingWallet || isPending
      ? {
          tone: 'cw-panel--warm',
          chip: pick('签名', 'Sign'),
          chipTone: 'cw-chip--warm',
          title: selectedTask ? pick(`请在钱包确认 ${selectedTask.title}`, `Sign ${selectedTask.title}`) : pick('请在钱包确认任务', 'Sign task'),
          detail: pick('先去钱包确认，再回来等链上结果。', 'Confirm in wallet, then wait for the on-chain result.'),
        }
      : receiptQuery.isLoading && submittedTask
        ? {
            tone: 'cw-panel--warm',
            chip: pick('确认中', 'Confirming'),
            chipTone: 'cw-chip--warm',
            title: pick(`${submittedTask.title} 链上确认中`, `${submittedTask.title} is confirming`),
            detail: pick('交易已发出，等回执。', 'Transaction sent. Waiting for receipt.'),
          }
        : null;

  function handleOpenTask(taskKey: string) {
    setSelectedTaskKey(taskKey);
    setSheetMode('preview');
    setSheetOpen(true);
    setResult(null);
  }

  async function handleRefreshPreview() {
    setRefreshingPreview(true);
    try {
      await Promise.all([
        previewQuery.refetch(),
        lastTaskTimeQuery.refetch(),
        lastTaskTypeQuery.refetch(),
        sameTypeStreakQuery.refetch(),
        rewardMultiplierQuery.refetch(),
      ]);
    } finally {
      setRefreshingPreview(false);
    }
  }

  async function handleExecute() {
    if (!selectedTask || !preview || !canExecute) return;

    setSubmittedTask(selectedTask);
    setSubmittedPreview(preview);
    setAwaitingWallet(true);
    try {
      await writeContractAsync({
        ...taskSkillContract,
        functionName: 'ownerCompleteTypedTask',
        args: [
          companion.tokenId,
          selectedTask.taskType,
          selectedTask.xpReward,
          selectedTask.requestedClw,
          preview.matchScore,
        ],
      });
    } catch {
      // wagmi error handled above
    } finally {
      setAwaitingWallet(false);
    }
  }

  return (
    <>
      <WalletGate
        title={pick('先连接持有人钱包', 'Connect owner wallet first')}
        detail={pick('连接后才能开始挖矿。', 'Connect before mining.')}
      >
        <div className="cw-button-row">
          <button
            type="button"
            className="cw-button cw-button--secondary"
            onClick={() => setTaskRollNonce((current) => current + 1)}
          >
            <TimerReset size={16} />
            {pick('换一批任务', 'Refresh tasks')}
          </button>
        </div>
        <section className="cw-card-stack">
          {rankedTaskTemplates.map((task) => {
            const Icon = task.icon;
            return (
              <button
                key={task.key}
                type="button"
                className={`cw-card cw-card--button ${task.tone} ${selectedTask?.key === task.key ? 'cw-card--selected' : ''}`}
                onClick={() => handleOpenTask(task.key)}
              >
                <div className="cw-card-icon">
                  <Icon size={18} />
                </div>
                <div className="cw-card-copy">
                  <p className="cw-label">{task.title}</p>
                  <p className="cw-card-note">{pick(`成长 ${getTaskTraitLabel(task.taskType, pick)} +1`, `Growth ${getTaskTraitLabel(task.taskType, pick)} +1`)}</p>
                  <h3>{pick(`约 ${formatCLW(task.requestedClw)}`, `~${formatCLW(task.requestedClw)}`)}</h3>
                </div>
                <div className="cw-score">
                  <strong>{task.score}%</strong>
                  <span>{task.detail}</span>
                </div>
              </button>
            );
          })}
        </section>

        {sheetOpen && selectedTask ? (
          <section className="cw-modal" aria-modal="true" role="dialog">
            <button
              type="button"
              className="cw-modal__scrim"
              aria-label={pick('关闭', 'Close')}
              onClick={() => {
                if (!awaitingWallet && !receiptQuery.isLoading) {
                  setSheetOpen(false);
                  setSheetMode('preview');
                }
              }}
            />
            <div className="cw-modal__sheet">
              <section className="cw-sheet">
                <div className="cw-sheet-head">
                  <div>
                    <span className="cw-label">
                      {sheetMode === 'preview' ? pick('预览', 'Preview') : pick('确认', 'Confirm')}
                    </span>
                    <h3>{selectedTask.title}</h3>
                    {selectedTask.summary ? <p className="cw-muted">{selectedTask.summary}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="cw-icon-button cw-sheet-close"
                    onClick={() => {
                      if (!awaitingWallet && !receiptQuery.isLoading) {
                        setSheetOpen(false);
                        setSheetMode('preview');
                      }
                    }}
                    aria-label={pick('关闭', 'Close')}
                    disabled={awaitingWallet || receiptQuery.isLoading}
                  >
                    <X size={16} />
                  </button>
                </div>

                {previewLoading ? (
                  <div className="cw-loading-card">
                    <div className="cw-skeleton-line cw-skeleton-line--short" />
                    <div className="cw-skeleton-grid">
                      <div className="cw-skeleton-block" />
                      <div className="cw-skeleton-block" />
                      <div className="cw-skeleton-block" />
                    </div>
                    <div className="cw-skeleton-line" />
                    <div className="cw-skeleton-line cw-skeleton-line--mid" />
                  </div>
                ) : previewUnavailable ? (
                  <>
                    <div className="cw-list">
                      <div className="cw-list-item cw-list-item--alert">
                        <Shield size={16} />
                        <span>{pick(`预览失败：${normalizeTaskErrorMessage(previewReadError, pick)}`, `Preview failed: ${normalizeTaskErrorMessage(previewReadError, pick)}`)}</span>
                      </div>
                    </div>

                    <div className="cw-button-row">
                      <button
                        type="button"
                        className="cw-button cw-button--secondary"
                        disabled={previewRefreshing}
                        onClick={() => void handleRefreshPreview()}
                      >
                        <TimerReset size={16} />
                        {previewRefreshing ? pick('重读中', 'Refreshing') : pick('重试预览', 'Retry preview')}
                      </button>
                      <button
                        type="button"
                        className="cw-button cw-button--ghost"
                        onClick={() => setSheetOpen(false)}
                      >
                        {pick('关闭', 'Close')}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="cw-state-grid">
                      <div className="cw-state-card">
                        <span className="cw-label">{pick('请求奖励', 'Requested')}</span>
                        <strong>{formatCLW(selectedTask.requestedClw)}</strong>
                      </div>
                      <div className="cw-state-card">
                        <span className="cw-label">{pick('预计奖励', 'Projected')}</span>
                        <strong>{preview ? formatCLW(preview.actualClw) : '--'}</strong>
                      </div>
                      <div className="cw-state-card">
                        <span className="cw-label">XP</span>
                        <strong>{selectedTask.xpReward}</strong>
                      </div>
                    </div>

                    <div className="cw-detail-list">
                      <div className="cw-detail-row">
                        <span>{pick('冷却', 'Cooldown')}</span>
                        <strong>{effectiveCooldownReady ? pick('就绪', 'Ready') : formatRemaining(cooldownRemaining, pick)}</strong>
                      </div>
                      <div className="cw-detail-row">
                        <span>{pick('匹配', 'Match')}</span>
                        <strong>{preview ? `${Math.round(preview.matchScore / 100)}%` : '--'}</strong>
                      </div>
                      <div className="cw-detail-row">
                        <span>{pick('连胜倍率', 'Streak')}</span>
                        <strong>{preview ? formatBasisPoints(preview.streakMul) : '--'}</strong>
                      </div>
                      <div className="cw-detail-row">
                        <span>{pick('世界倍率', 'World')}</span>
                        <strong>{preview ? formatBasisPoints(preview.worldMul) : '--'}</strong>
                      </div>
                      <div className="cw-detail-row">
                        <span>{pick('预估 gas', 'Gas')}</span>
                        <strong>{gasCostWei !== null ? `${formatBNB(gasCostWei, 6)} BNB` : '--'}</strong>
                      </div>
                    </div>

                    <div className="cw-list">
                      {!companion.active ? (
                        <div className="cw-list-item cw-list-item--cool">
                          <TimerReset size={16} />
                          <span>{pick('先维护，再挖矿。', 'Process upkeep before mining.')}</span>
                        </div>
                      ) : null}
                      {!effectiveCooldownReady ? (
                        <div className="cw-list-item cw-list-item--cool">
                          <TimerReset size={16} />
                          <span>{pick(`还要等 ${formatRemaining(cooldownRemaining, pick)}`, `Wait ${formatRemaining(cooldownRemaining, pick)}`)}</span>
                        </div>
                      ) : null}
                      {selectedTaskTraitLabel ? (
                        <div className={`cw-list-item ${preview?.personalityDrift ? 'cw-list-item--growth' : 'cw-list-item--cool'}`}>
                          <Sparkles size={16} />
                          <span>
                            {preview?.personalityDrift
                              ? pick(`本次成长：${selectedTaskTraitLabel} +1`, `Growth this run: ${selectedTaskTraitLabel} +1`)
                              : pick(`本次不加点：${selectedTaskTraitLabel}`, `No growth this run: ${selectedTaskTraitLabel}`)}
                          </span>
                        </div>
                      ) : null}
                      {previewFallbackNote ? (
                        <div className="cw-list-item cw-list-item--cool">
                          <Shield size={16} />
                          <span>{previewFallbackNote}</span>
                        </div>
                      ) : null}
                      {gasEstimateError ? (
                        <div className="cw-list-item cw-list-item--cool">
                          <Shield size={16} />
                          <span>{pick(`Gas 估算失败：${gasEstimateError}`, `Gas estimate failed: ${gasEstimateError}`)}</span>
                        </div>
                      ) : null}
                      {chainPreviewEnabled && previewQuery.error && !previewFallbackNote ? (
                        <div className="cw-list-item cw-list-item--cool">
                          <Shield size={16} />
                          <span>{pick(`预览失败：${normalizeTaskErrorMessage(previewQuery.error, pick)}`, `Preview failed: ${normalizeTaskErrorMessage(previewQuery.error, pick)}`)}</span>
                        </div>
                      ) : null}
                      {lastTaskTimeQuery.error ? (
                        <div className="cw-list-item cw-list-item--cool">
                          <Shield size={16} />
                          <span>{pick(`冷却读取失败：${normalizeTaskErrorMessage(lastTaskTimeQuery.error, pick)}`, `Cooldown read failed: ${normalizeTaskErrorMessage(lastTaskTimeQuery.error, pick)}`)}</span>
                        </div>
                      ) : null}
                      {(awaitingWallet || isPending) && sheetMode === 'confirm' ? (
                        <div className="cw-list-item cw-list-item--warm">
                          <Shield size={16} />
                          <span>{pick('现在去钱包确认。', 'Open the wallet and confirm now.')}</span>
                        </div>
                      ) : null}
                      {receiptQuery.isLoading && sheetMode === 'confirm' ? (
                        <div className="cw-list-item cw-list-item--cool">
                          <TimerReset size={16} />
                          <span>{pick('交易已发出，正在等回执。', 'Transaction sent. Waiting for receipt.')}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="cw-button-row">
                      {previewNeedsRetry ? (
                        <button
                          type="button"
                          className="cw-button cw-button--secondary"
                          disabled={previewRefreshing}
                          onClick={() => void handleRefreshPreview()}
                        >
                          <TimerReset size={16} />
                          {previewRefreshing ? pick('重读中', 'Refreshing') : pick('重试预览', 'Retry preview')}
                        </button>
                      ) : null}
                      {sheetMode === 'preview' ? (
                        <>
                          <button
                            type="button"
                            className="cw-button cw-button--primary"
                            disabled={!selectedTask || !preview || Boolean(gasEstimateError)}
                            onClick={() => setSheetMode('confirm')}
                          >
                            <CheckCircle2 size={16} />
                            {pick('继续确认', 'Continue')}
                          </button>
                          <button
                            type="button"
                            className="cw-button cw-button--ghost"
                            onClick={() => setSheetOpen(false)}
                          >
                            {pick('关闭', 'Close')}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="cw-button cw-button--primary"
                            disabled={!canExecute || awaitingWallet || isPending || receiptQuery.isLoading}
                            onClick={() => void handleExecute()}
                          >
                            <Sparkles size={16} />
                            {awaitingWallet || isPending
                              ? pick('等钱包签名', 'Waiting for signature')
                              : receiptQuery.isLoading
                                ? pick('链上确认中', 'Confirming')
                                : pick('执行任务', 'Execute task')}
                          </button>
                          <button
                            type="button"
                            className="cw-button cw-button--ghost"
                            disabled={awaitingWallet || isPending || receiptQuery.isLoading}
                            onClick={() => setSheetMode('preview')}
                          >
                            {pick('返回预览', 'Back')}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </section>
            </div>
          </section>
        ) : null}

        {taskPulse ? (
          <section className={`cw-panel ${taskPulse.tone}`}>
            <div className="cw-section-head">
              <div>
                <span className="cw-label">{pick('任务状态', 'Task pulse')}</span>
                <h3>{taskPulse.title}</h3>
              </div>
              <span className={`cw-chip ${taskPulse.chipTone}`}>{taskPulse.chip}</span>
            </div>
            <p className="cw-muted">{taskPulse.detail}</p>
            {hash ? (
              <div className="cw-button-row">
                <a
                  href={getBscScanTxUrl(hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cw-button cw-button--secondary"
                >
                  <ArrowUpRight size={16} />
                  {pick('查看交易', 'View transaction')}
                </a>
              </div>
            ) : null}
          </section>
        ) : null}

        {result ? (
          <section className="cw-result-panel cw-result-panel--success">
            <div className="cw-result-head">
              <div className="cw-result-icon">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <span className="cw-label">{pick('任务完成', 'Task complete')}</span>
                <h3>{result.taskTitle}</h3>
                <div className="cw-result-celebration">+{formatCLW(result.actualClw)}</div>
              </div>
            </div>

            <div className="cw-result-grid">
              <div className="cw-result-stat cw-result-stat--hero">
                <span className="cw-label">{pick('实际奖励', 'Actual reward')}</span>
                <strong>+{formatCLW(result.actualClw)}</strong>
              </div>
              <div className="cw-result-stat">
                <span className="cw-label">XP</span>
                <strong>+{result.xpReward}</strong>
              </div>
              <div className="cw-result-stat">
                <span className="cw-label">{pick('匹配', 'Match')}</span>
                <strong>{Math.round(result.matchScore / 100)}%</strong>
              </div>
            </div>

            <div className="cw-list">
              <div className="cw-list-item cw-list-item--warm">
                <Sparkles size={16} />
                <span>
                  {pick(
                    `请求 ${formatCLW(result.requestedClw)} / 实际 ${formatCLW(result.actualClw)}`,
                    `Requested ${formatCLW(result.requestedClw)} / actual ${formatCLW(result.actualClw)}`,
                  )}
                </span>
              </div>
              <div className={`cw-list-item ${result.driftState === 'applied' ? 'cw-list-item--warm' : 'cw-list-item--cool'}`}>
                <Shield size={16} />
                <span>
                  {result.driftState === 'applied'
                    ? pick(`${getTaskTraitLabel(result.taskType, pick)} +1`, `${getTaskTraitLabel(result.taskType, pick)} +1`)
                    : result.driftState === 'skipped'
                      ? pick(`${getTaskTraitLabel(result.taskType, pick)} 本次未增长：${result.driftReason ?? '受上限约束'}`, `${getTaskTraitLabel(result.taskType, pick)} did not grow: ${result.driftReason ?? 'bounded by cap'}`)
                      : pick(`${getTaskTraitLabel(result.taskType, pick)} 本次未增长`, `${getTaskTraitLabel(result.taskType, pick)} did not grow this run`)}
                </span>
              </div>
            </div>

            <div className="cw-button-row">
              <a
                href={getBscScanTxUrl(result.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="cw-button cw-button--secondary"
              >
                <ArrowUpRight size={16} />
                {pick('查看交易', 'View transaction')}
              </a>
              <button type="button" className="cw-button cw-button--ghost" onClick={() => setResult(null)}>
                {pick('完成', 'Done')}
              </button>
            </div>
          </section>
        ) : null}
      </WalletGate>
    </>
  );
}
