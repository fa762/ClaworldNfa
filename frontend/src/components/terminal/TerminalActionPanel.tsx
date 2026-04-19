'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Pickaxe, RefreshCw, X } from 'lucide-react';
import { decodeEventLog, parseEther } from 'viem';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { BattleRoyaleArenaPanel } from '@/components/game/BattleRoyaleArenaPanel';
import { PKArenaPanel } from '@/components/game/PKArenaPanel';
import { useBattleRoyaleOverview } from '@/components/lobster/useBattleRoyaleOverview';
import { useBattleRoyaleParticipantState } from '@/components/lobster/useBattleRoyaleParticipantState';
import type { ActiveCompanionValue } from '@/components/lobster/useActiveCompanion';
import { MintPanel } from '@/components/mint/MintPanel';
import { AutonomyPanel } from '@/components/nfa/AutonomyPanel';
import { TaskSkillABI } from '@/contracts/abis/TaskSkill';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import { useRewardMultiplier } from '@/contracts/hooks/useWorldState';
import { formatCLW } from '@/lib/format';
import type { TerminalActionIntent, TerminalCard } from '@/lib/terminal-cards';

import styles from './TerminalHome.module.css';

type TaskTemplate = {
  key: string;
  title: string;
  taskType: number;
  trait: string;
  xpReward: number;
  requestedClw: bigint;
  score: number;
  note: string;
};

type TaskPreview = {
  matchScore: number;
  actualClw: bigint;
  streakMul: bigint;
  worldMul: bigint;
  cooldownReady: boolean;
};

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function taskTraitValue(taskType: number, companion: ActiveCompanionValue) {
  if (taskType === 0) return companion.traits.courage;
  if (taskType === 1) return companion.traits.wisdom;
  if (taskType === 2) return companion.traits.social;
  if (taskType === 3) return companion.traits.create;
  return companion.traits.grit;
}

function buildTerminalTasks(companion: ActiveCompanionValue, roll: number): TaskTemplate[] {
  const pools = [
    {
      key: 'courage',
      title: '废墟探索',
      taskType: 0,
      trait: '勇气',
      base: 34 + companion.traits.courage * 0.32 + companion.traits.grit * 0.14,
      min: 55,
      max: 90,
      note: '高回报',
    },
    {
      key: 'wisdom',
      title: '密码破译',
      taskType: 1,
      trait: '智慧',
      base: 30 + companion.traits.wisdom * 0.26 + companion.traits.create * 0.12,
      min: 45,
      max: 75,
      note: '稳收益',
    },
    {
      key: 'social',
      title: '商路谈判',
      taskType: 2,
      trait: '社交',
      base: 31 + companion.traits.social * 0.28 + companion.traits.wisdom * 0.16,
      min: 48,
      max: 78,
      note: '低波动',
    },
    {
      key: 'create',
      title: '终端改装',
      taskType: 3,
      trait: '创造',
      base: 32 + companion.traits.create * 0.28 + companion.traits.social * 0.14,
      min: 50,
      max: 80,
      note: '平衡',
    },
    {
      key: 'grit',
      title: '守夜巡逻',
      taskType: 4,
      trait: '韧性',
      base: 33 + companion.traits.grit * 0.3 + companion.traits.courage * 0.16,
      min: 52,
      max: 84,
      note: '抗压',
    },
  ];

  return pools
    .map((pool, index) => ({
      ...pool,
      order: (companion.tokenNumber * (11 + index * 3) + roll * (5 + index * 2)) % 97,
    }))
    .sort((left, right) => left.order - right.order)
    .slice(0, 3)
    .map((pool) => {
      const reward = clamp(Math.round(pool.base + companion.level * 1.7), pool.min, pool.max);
      const traitValue = taskTraitValue(pool.taskType, companion);
      return {
        key: pool.key,
        title: pool.title,
        taskType: pool.taskType,
        trait: pool.trait,
        xpReward: clamp(12 + companion.level * 2 + Math.round(traitValue / 24), 10, 32),
        requestedClw: parseEther(String(reward)),
        score: clamp(Math.round(traitValue * 1.45 + companion.level * 2), 8, 99),
        note: pool.note,
      };
    });
}

function taskError(error: unknown) {
  if (!(error instanceof Error)) return '操作失败。';
  const message = error.message;
  if (message.includes('User rejected') || message.includes('OKX Wallet Reject')) return '钱包取消了这次签名。';
  if (message.includes('Cooldown active')) return '任务还在冷却。';
  if (message.includes('Not NFA owner')) return '当前钱包不是这只龙虾的持有人。';
  if (message.includes('CLW cap exceeded')) return '这次奖励超过合约上限。';
  if (message.includes('XP cap exceeded')) return '这次经验超过合约上限。';
  return message;
}

function formatRemaining(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) return `${hours}小时${minutes}分`;
  if (minutes > 0) return `${minutes}分${secs}秒`;
  return `${secs}秒`;
}

function TerminalMiningPanel({
  companion,
  onReceipt,
}: {
  companion: ActiveCompanionValue;
  onReceipt: (card: TerminalCard) => void;
}) {
  const { address } = useAccount();
  const rewardMultiplierQuery = useRewardMultiplier();
  const { data: hash, error, isPending, writeContractAsync } = useWriteContract();
  const receiptQuery = useWaitForTransactionReceipt({ hash });

  const [roll, setRoll] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ task: TaskTemplate; preview: TaskPreview } | null>(null);
  const [awaitingWallet, setAwaitingWallet] = useState(false);
  const [handledHash, setHandledHash] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  const tasks = useMemo(() => buildTerminalTasks(companion, roll), [companion, roll]);
  const selected = tasks.find((task) => task.key === selectedKey) ?? tasks[0];

  useEffect(() => {
    setSelectedKey((current) => (current && tasks.some((task) => task.key === current) ? current : tasks[0]?.key ?? null));
  }, [tasks]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const lastTaskTimeQuery = useReadContract({
    address: addresses.taskSkill,
    abi: TaskSkillABI,
    functionName: 'lastTaskTime',
    args: companion.hasToken ? [companion.tokenId] : undefined,
    query: { enabled: companion.hasToken },
  });
  const lastTaskTypeQuery = useReadContract({
    address: addresses.taskSkill,
    abi: taskPreviewStateAbi,
    functionName: 'lastTaskType',
    args: companion.hasToken ? [companion.tokenId] : undefined,
    query: { enabled: companion.hasToken },
  });
  const sameTypeStreakQuery = useReadContract({
    address: addresses.taskSkill,
    abi: taskPreviewStateAbi,
    functionName: 'sameTypeStreak',
    args: companion.hasToken ? [companion.tokenId] : undefined,
    query: { enabled: companion.hasToken },
  });

  const lastTaskTime = Number(lastTaskTimeQuery.data?.toString() ?? '0');
  const cooldownEndsAt = lastTaskTime > 0 ? lastTaskTime + 4 * 60 * 60 : 0;
  const cooldownRemaining = Math.max(0, cooldownEndsAt - now);
  const lastTaskType = Number((lastTaskTypeQuery.data as number | bigint | undefined) ?? 255);
  const sameTypeStreak = Number((sameTypeStreakQuery.data as number | bigint | undefined) ?? 0);
  const rewardMultiplier = BigInt((rewardMultiplierQuery.data as bigint | undefined) ?? 10000n);

  const preview = useMemo(() => {
    if (!selected) return null;
    const matchScore = clamp(taskTraitValue(selected.taskType, companion) * 200, 0, 20000);
    const nextStreak = sameTypeStreak > 0 && lastTaskType === selected.taskType ? sameTypeStreak + 1 : 1;
    let streakMul = 10000n;
    if (nextStreak === 2) streakMul = 8000n;
    else if (nextStreak === 3) streakMul = 6000n;
    else if (nextStreak >= 4) streakMul = 5000n;

    return {
      matchScore,
      actualClw: (selected.requestedClw * BigInt(matchScore) * rewardMultiplier * streakMul) / 10000n / 10000n / 10000n,
      streakMul,
      worldMul: rewardMultiplier,
      cooldownReady: cooldownRemaining === 0,
    } satisfies TaskPreview;
  }, [companion, cooldownRemaining, lastTaskType, rewardMultiplier, sameTypeStreak, selected]);

  async function executeSelected() {
    if (!selected || !preview || !address || !preview.cooldownReady || isPending || receiptQuery.isLoading) return;
    setSubmitted({ task: selected, preview });
    setAwaitingWallet(true);
    try {
      await writeContractAsync({
        address: addresses.taskSkill,
        abi: TaskSkillABI,
        functionName: 'ownerCompleteTypedTask',
        args: [companion.tokenId, selected.taskType, selected.xpReward, selected.requestedClw, preview.matchScore],
      });
    } finally {
      setAwaitingWallet(false);
    }
  }

  useEffect(() => {
    if (!hash || handledHash === hash || !receiptQuery.data || !submitted) return;

    let actualClw = submitted.preview.actualClw;
    let matchScore = submitted.preview.matchScore;
    let growth = '本次未返回属性事件';

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
          growth = `${submitted.task.trait} +1`;
        }
        if (decoded.eventName === 'TaskPersonalityDriftSkipped') {
          growth = `${submitted.task.trait} 未增长：${decoded.args.reason ?? '达到限制'}`;
        }
      } catch {}
    }

    setHandledHash(hash);
    setRoll((current) => current + 1);
    onReceipt({
      id: `mining-receipt-${hash}`,
      type: 'receipt',
      label: '挖矿回执',
      title: `${submitted.task.title} 完成`,
      body: `获得 ${formatCLW(actualClw)} Claworld，${growth}。`,
      details: [
        { label: '奖励', value: `${formatCLW(actualClw)} Claworld`, tone: 'growth' },
        { label: '经验', value: `+${submitted.task.xpReward}` },
        { label: '匹配', value: `${Math.round(matchScore / 200)}%` },
        { label: '交易', value: `${hash.slice(0, 10)}...`, tone: 'warm' },
      ],
      cta: { label: '查看交易', href: getBscScanTxUrl(hash) },
    });
  }, [handledHash, hash, onReceipt, receiptQuery.data, submitted]);

  return (
    <section className={styles.inlinePanel}>
      <div className={styles.inlineHead}>
        <div>
          <span>任务挖矿</span>
          <strong>选任务，确认后直接上链</strong>
        </div>
        <button type="button" className={styles.panelButton} onClick={() => setRoll((current) => current + 1)}>
          <RefreshCw size={14} />
          换一批
        </button>
      </div>

      <div className={styles.taskDeck}>
        {tasks.map((task) => (
          <button
            key={task.key}
            type="button"
            className={`${styles.taskTile} ${selected?.key === task.key ? styles.taskTileActive : ''}`}
            onClick={() => setSelectedKey(task.key)}
          >
            <span>{task.trait} +1</span>
            <strong>{task.title}</strong>
            <em>约 {formatCLW(task.requestedClw)} Claworld</em>
            <small>{task.score}% · {task.note}</small>
          </button>
        ))}
      </div>

      {selected && preview ? (
        <div className={styles.inlineSummary}>
          <div>
            <span>奖励</span>
            <strong>{formatCLW(preview.actualClw)} Claworld</strong>
          </div>
          <div>
            <span>属性</span>
            <strong>{selected.trait} +1</strong>
          </div>
          <div>
            <span>状态</span>
            <strong>{preview.cooldownReady ? '可开始' : `还要 ${formatRemaining(cooldownRemaining)}`}</strong>
          </div>
          <div>
            <span>世界倍率</span>
            <strong>{(Number(preview.worldMul) / 10000).toFixed(2)}x</strong>
          </div>
        </div>
      ) : null}

      <div className={styles.inlineActions}>
        <button
          type="button"
          className={styles.primaryPanelButton}
          onClick={() => void executeSelected()}
          disabled={!selected || !preview?.cooldownReady || isPending || receiptQuery.isLoading}
        >
          <Pickaxe size={16} />
          {awaitingWallet ? '等待钱包签名' : receiptQuery.isLoading ? '链上确认中' : '确认挖矿'}
        </button>
      </div>

      {error ? <p className={styles.panelError}>{taskError(error)}</p> : null}
      {hash ? (
        <a className={styles.panelLink} href={getBscScanTxUrl(hash)} target="_blank" rel="noreferrer">
          查看交易 {hash.slice(0, 10)}...
        </a>
      ) : null}
    </section>
  );
}

function TerminalArenaPanel({ companion }: { companion: ActiveCompanionValue }) {
  const [mode, setMode] = useState<'pk' | 'br'>('pk');
  const battleRoyale = useBattleRoyaleOverview();
  const participant = useBattleRoyaleParticipantState(
    battleRoyale.matchId,
    companion.hasToken ? companion.tokenId : undefined,
    companion.ownerAddress,
  );

  return (
    <section className={styles.inlinePanel}>
      <div className={styles.inlineHead}>
        <div>
          <span>竞技</span>
          <strong>{mode === 'pk' ? 'PK 对局' : '大逃杀房间'}</strong>
        </div>
        <div className={styles.segmented}>
          <button type="button" className={mode === 'pk' ? styles.segmentActive : ''} onClick={() => setMode('pk')}>
            PK
          </button>
          <button type="button" className={mode === 'br' ? styles.segmentActive : ''} onClick={() => setMode('br')}>
            大逃杀
          </button>
        </div>
      </div>
      {mode === 'pk' ? (
        <PKArenaPanel
          tokenId={companion.hasToken ? companion.tokenId : undefined}
          ownerAddress={companion.ownerAddress}
          companionName={companion.name}
          reserve={companion.routerClaworld}
          reserveText={companion.routerClaworldText}
          pkWins={companion.pkWins}
          pkLosses={companion.pkLosses}
          pkWinRate={companion.pkWinRate}
          level={companion.level}
          traits={companion.traits}
        />
      ) : (
        <BattleRoyaleArenaPanel
          matchId={battleRoyale.matchId}
          status={battleRoyale.status}
          revealBlock={battleRoyale.revealBlock}
          losingRoom={battleRoyale.losingRoom}
          totalPlayers={battleRoyale.totalPlayers}
          triggerCount={battleRoyale.triggerCount}
          pot={battleRoyale.pot}
          minStake={battleRoyale.minStake}
          tokenId={companion.hasToken ? companion.tokenId : undefined}
          reserve={companion.routerClaworld}
          participant={participant}
          onRefresh={battleRoyale.refresh}
          isRefreshing={battleRoyale.isRefreshing}
        />
      )}
    </section>
  );
}

function TerminalAutonomyPanel({ companion }: { companion: ActiveCompanionValue }) {
  return (
    <section className={styles.inlinePanel}>
      <div className={styles.inlineHead}>
        <div>
          <span>代理</span>
          <strong>开通、预算、策略、结果都在这里</strong>
        </div>
      </div>
      <AutonomyPanel
        tokenId={companion.tokenId}
        ownerAddress={companion.ownerAddress}
        clwBalance={companion.routerClaworld}
        dailyCost={companion.dailyCost}
      />
    </section>
  );
}

function TerminalMintPanel({ onClose }: { onClose: () => void }) {
  return (
    <section className={styles.inlinePanel}>
      <div className={styles.inlineHead}>
        <div>
          <span>铸造</span>
          <strong>铸造新 NFA</strong>
        </div>
        <button type="button" className={styles.panelButton} onClick={onClose}>
          <X size={14} />
          收起
        </button>
      </div>
      <MintPanel />
    </section>
  );
}

export function TerminalActionPanel({
  action,
  companion,
  onClose,
  onReceipt,
}: {
  action: TerminalActionIntent;
  companion: ActiveCompanionValue;
  onClose: () => void;
  onReceipt: (card: TerminalCard) => void;
}) {
  if (action === 'mining') {
    return (
      <div className={styles.actionPanelWrap}>
        <TerminalMiningPanel companion={companion} onReceipt={onReceipt} />
      </div>
    );
  }
  if (action === 'arena') {
    return (
      <div className={styles.actionPanelWrap}>
        <TerminalArenaPanel companion={companion} />
      </div>
    );
  }
  if (action === 'auto') {
    return (
      <div className={styles.actionPanelWrap}>
        <TerminalAutonomyPanel companion={companion} />
      </div>
    );
  }
  if (action === 'mint') {
    return (
      <div className={styles.actionPanelWrap}>
        <TerminalMintPanel onClose={onClose} />
      </div>
    );
  }
  return (
    <div className={styles.actionPanelWrap}>
      <section className={styles.inlinePanel}>
        <div className={styles.inlineHead}>
          <div>
            <span>状态</span>
            <strong>{companion.name}</strong>
          </div>
          <CheckCircle2 size={18} />
        </div>
        <div className={styles.inlineSummary}>
          <div>
            <span>储备</span>
            <strong>{companion.routerClaworldText}</strong>
          </div>
          <div>
            <span>续航</span>
            <strong>{companion.upkeepDays === null ? '--' : `${companion.upkeepDays}天`}</strong>
          </div>
          <div>
            <span>胜败</span>
            <strong>{companion.pkWins}胜 / {companion.pkLosses}败</strong>
          </div>
          <div>
            <span>状态</span>
            <strong>{companion.statusLabel}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
