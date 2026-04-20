'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, Brain, CheckCircle2, Pickaxe, RefreshCw, Shield, Swords, Trophy, X } from 'lucide-react';
import { decodeEventLog, keccak256, parseEther, toBytes } from 'viem';
import { useAccount, useReadContract, useSignMessage, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { BattleRoyaleArenaPanel } from '@/components/game/BattleRoyaleArenaPanel';
import { PKArenaPanel } from '@/components/game/PKArenaPanel';
import { useBattleRoyaleOverview } from '@/components/lobster/useBattleRoyaleOverview';
import { useBattleRoyaleParticipantState } from '@/components/lobster/useBattleRoyaleParticipantState';
import type { ActiveCompanionValue } from '@/components/lobster/useActiveCompanion';
import { MintPanel } from '@/components/mint/MintPanel';
import { AutonomyPanel } from '@/components/nfa/AutonomyPanel';
import { ClawNFAABI } from '@/contracts/abis/ClawNFA';
import { TaskSkillABI } from '@/contracts/abis/TaskSkill';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import { useRewardMultiplier } from '@/contracts/hooks/useWorldState';
import { formatCLW } from '@/lib/format';
import type { TerminalActionIntent, TerminalCard } from '@/lib/terminal-cards';

import styles from './TerminalHome.module.css';
import { useTerminalAutonomy } from './useTerminalAutonomy';

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

type DirectiveStyle = 'tight' | 'balanced' | 'expressive';

type DirectiveApiResponse = {
  tokenId: number;
  actionKind: number;
  style: DirectiveStyle;
  text: string;
  updatedAt: number | null;
  updatedBy: string | null;
  error?: string;
};

const AUTONOMY_ACTION_MODES = [
  { key: 'task', label: '任务代理', actionKind: 0, oneLine: '自动挑任务，优先稳收益。' },
  { key: 'pk', label: 'PK 代理', actionKind: 1, oneLine: '只接胜率舒服的局。' },
  { key: 'br', label: '大逃杀代理', actionKind: 3, oneLine: '选房间，控质押，等结算。' },
] as const;

const DIRECTIVE_STYLES: Array<{ value: DirectiveStyle; label: string; text: string }> = [
  { value: 'tight', label: '保守', text: '先保底，少冒险。' },
  { value: 'balanced', label: '平衡', text: '收益和风险一起看。' },
  { value: 'expressive', label: '激进', text: '机会明显时更主动。' },
];

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

function formatRawClw(raw: string | bigint | null | undefined) {
  if (raw === null || raw === undefined) return '--';
  try {
    return `${formatCLW(typeof raw === 'bigint' ? raw : BigInt(raw))} Claworld`;
  } catch {
    return '--';
  }
}

function matchStatusLabel(status: number) {
  if (status === 0) return '开放中';
  if (status === 1) return '待揭示';
  if (status === 2) return '已结算';
  return '--';
}

function skillLabel(skill: string) {
  if (skill === 'task') return '任务';
  if (skill === 'pk') return 'PK';
  if (skill === 'battle_royale') return '大逃杀';
  return skill;
}

function buildDirectiveMessage(
  tokenId: bigint,
  actionKind: number,
  style: DirectiveStyle,
  text: string,
  issuedAt: number,
) {
  return [
    'Clawworld Autonomy Directive',
    `tokenId:${tokenId.toString()}`,
    `actionKind:${actionKind}`,
    `style:${style}`,
    `text:${text.trim().slice(0, 220)}`,
    `issuedAt:${issuedAt}`,
  ].join('\n');
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
  const [expanded, setExpanded] = useState(false);
  const battleRoyale = useBattleRoyaleOverview();
  const participant = useBattleRoyaleParticipantState(
    battleRoyale.matchId,
    companion.hasToken ? companion.tokenId : undefined,
    companion.ownerAddress,
  );
  const brPlayers = `${battleRoyale.totalPlayers}/${battleRoyale.triggerCount || 10}`;
  const brPot = `${formatCLW(battleRoyale.pot)} Claworld`;
  const brClaim = participant.claimable > 0n ? `${formatCLW(participant.claimable)} Claworld` : '--';

  return (
    <section className={styles.inlinePanel}>
      <div className={styles.inlineHead}>
        <div>
          <span>竞技</span>
          <strong>{mode === 'pk' ? 'PK：挑对手再出招' : '大逃杀：选房间躲淘汰'}</strong>
        </div>
        <div className={styles.segmented}>
          <button
            type="button"
            className={mode === 'pk' ? styles.segmentActive : ''}
            onClick={() => {
              setMode('pk');
              setExpanded(false);
            }}
          >
            PK
          </button>
          <button
            type="button"
            className={mode === 'br' ? styles.segmentActive : ''}
            onClick={() => {
              setMode('br');
              setExpanded(false);
            }}
          >
            大逃杀
          </button>
        </div>
      </div>

      <div className={styles.actionHero}>
        <div>
          <span>{mode === 'pk' ? '当前状态' : `当前局 #${battleRoyale.matchId?.toString() ?? '--'}`}</span>
          <strong>{mode === 'pk' ? `${companion.pkWins}胜 / ${companion.pkLosses}败` : matchStatusLabel(battleRoyale.status)}</strong>
        </div>
        <p>
          {mode === 'pk'
            ? '看对手，选策略，提交后自动走揭示和结算。'
            : '任选五个房间之一质押，满 10 人后随机淘汰一个房间，幸存者按质押瓜分奖励。'}
        </p>
      </div>

      <div className={styles.inlineSummary}>
        {mode === 'pk' ? (
          <>
            <div>
              <span>储备</span>
              <strong>{companion.routerClaworldText}</strong>
            </div>
            <div>
              <span>胜率</span>
              <strong>{companion.pkWinRate}%</strong>
            </div>
            <div>
              <span>等级</span>
              <strong>Lv.{companion.level}</strong>
            </div>
            <div>
              <span>下一步</span>
              <strong>选擂台</strong>
            </div>
          </>
        ) : (
          <>
            <div>
              <span>人数</span>
              <strong>{brPlayers}</strong>
            </div>
            <div>
              <span>奖池</span>
              <strong>{brPot}</strong>
            </div>
            <div>
              <span>我的奖励</span>
              <strong>{brClaim}</strong>
            </div>
            <div>
              <span>路径</span>
              <strong>{participant.claimPathLabel ?? 'NFA 入场'}</strong>
            </div>
          </>
        )}
      </div>

      <div className={styles.inlineActions}>
        <button type="button" className={styles.primaryPanelButton} onClick={() => setExpanded((current) => !current)}>
          <Swords size={16} />
          {expanded ? '收起操作区' : mode === 'pk' ? '打开 PK 列表' : '打开房间操作'}
        </button>
        <button type="button" className={styles.panelButton} onClick={() => void battleRoyale.refresh()}>
          <RefreshCw size={14} />
          刷新
        </button>
      </div>

      {expanded ? (
        <div className={styles.actionModal} role="dialog" aria-modal="true" aria-label={mode === 'pk' ? 'PK 操作' : '大逃杀操作'}>
          <button type="button" className={styles.actionModalScrim} aria-label="关闭操作窗口" onClick={() => setExpanded(false)} />
          <div className={styles.actionModalSheet}>
            <div className={styles.actionModalHead}>
              <div>
                <span>{mode === 'pk' ? 'PK 操作' : '大逃杀操作'}</span>
                <strong>{mode === 'pk' ? '选擂台 / 开擂 / 亮招 / 结算' : '选房 / 入场 / 揭示 / 领奖'}</strong>
              </div>
              <button type="button" className={styles.modalCloseButton} onClick={() => setExpanded(false)} aria-label="关闭">
                <X size={16} />
              </button>
            </div>
            <div className={styles.actionModalBody}>
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
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TerminalDirectiveEditor({
  tokenId,
  ownerAddress,
  actionKind,
}: {
  tokenId: bigint;
  ownerAddress?: string;
  actionKind: number;
}) {
  const { address } = useAccount();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();
  const isOwner = Boolean(address && ownerAddress) && address!.toLowerCase() === ownerAddress!.toLowerCase();
  const [style, setStyle] = useState<DirectiveStyle>('balanced');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    fetch(`/api/autonomy/directive?tokenId=${tokenId.toString()}&actionKind=${actionKind}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = (await response.json()) as DirectiveApiResponse;
        if (!response.ok) throw new Error(data.error || '读取设定失败');
        if (cancelled) return;
        setStyle(data.style || 'balanced');
        setText(data.text || '');
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : '读取设定失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [actionKind, tokenId]);

  async function saveDirective() {
    if (!isOwner || saving || isSigning || !address) {
      setMessage('只有持有人钱包可以保存。');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const issuedAt = Date.now();
      const trimmed = text.trim().slice(0, 220);
      const signature = await signMessageAsync({
        message: buildDirectiveMessage(tokenId, actionKind, style, trimmed, issuedAt),
      });
      const response = await fetch('/api/autonomy/directive', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tokenId: Number(tokenId),
          actionKind,
          style,
          text: trimmed,
          issuedAt,
          signer: address,
          signature,
        }),
      });
      const data = (await response.json()) as DirectiveApiResponse;
      if (!response.ok) throw new Error(data.error || '保存失败');
      setStyle(data.style);
      setText(data.text);
      setMessage('已保存。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.directiveEditor}>
      <div className={styles.actionModes}>
        {DIRECTIVE_STYLES.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`${styles.actionModeButton} ${style === item.value ? styles.actionModeButtonActive : ''}`}
            onClick={() => setStyle(item.value)}
            disabled={loading || saving || isSigning}
          >
            <strong>{item.label}</strong>
            <span>{item.text}</span>
          </button>
        ))}
      </div>
      <label className={styles.compactField}>
        <span>一句提示</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, 220))}
          rows={3}
          disabled={!isOwner || loading || saving || isSigning}
          className={styles.compactTextarea}
          placeholder="例如：先领已结算奖励，再进新一局。"
        />
      </label>
      <div className={styles.inlineActions}>
        <button type="button" className={styles.primaryPanelButton} onClick={() => void saveDirective()} disabled={!isOwner || loading || saving || isSigning}>
          <Bot size={16} />
          {saving || isSigning ? '保存中' : '保存提示'}
        </button>
        <span className={styles.actionHint}>{text.length}/220</span>
      </div>
      {message ? <p className={styles.panelError}>{message}</p> : null}
    </div>
  );
}

function TerminalAutonomyPanel({ companion }: { companion: ActiveCompanionValue }) {
  const [modeKey, setModeKey] = useState<(typeof AUTONOMY_ACTION_MODES)[number]['key']>('task');
  const [expanded, setExpanded] = useState(false);
  const autonomy = useTerminalAutonomy(companion.hasToken ? companion.tokenId : undefined);
  const mode = AUTONOMY_ACTION_MODES.find((item) => item.key === modeKey) ?? AUTONOMY_ACTION_MODES[0];
  const recent = autonomy.status?.recentActions.slice(0, 3) ?? [];

  return (
    <section className={styles.inlinePanel}>
      <div className={styles.inlineHead}>
        <div>
          <span>代理</span>
          <strong>{autonomy.status?.enabled ? '代理已开启' : '设置自动代理'}</strong>
        </div>
        <Shield size={18} />
      </div>

      <div className={styles.actionModes}>
        {AUTONOMY_ACTION_MODES.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`${styles.actionModeButton} ${modeKey === item.key ? styles.actionModeButtonActive : ''}`}
            onClick={() => setModeKey(item.key)}
          >
            <strong>{item.label}</strong>
            <span>{item.oneLine}</span>
          </button>
        ))}
      </div>

      <div className={styles.inlineSummary}>
        <div>
          <span>储备</span>
          <strong>{companion.routerClaworldText}</strong>
        </div>
        <div>
          <span>剩余额度</span>
          <strong>{formatRawClw(autonomy.status?.budget.remainingCLW)}</strong>
        </div>
        <div>
          <span>状态</span>
          <strong>{autonomy.status?.enabled ? (autonomy.status.paused ? '暂停' : '运行') : '未开'}</strong>
        </div>
        <div>
          <span>当前策略</span>
          <strong>{mode.label}</strong>
        </div>
      </div>

      <TerminalDirectiveEditor tokenId={companion.tokenId} ownerAddress={companion.ownerAddress} actionKind={mode.actionKind} />

      <div className={styles.resultList}>
        <span>最近结果</span>
        {autonomy.isLoading ? <p>读取中...</p> : null}
        {!autonomy.isLoading && recent.length === 0 ? <p>暂无执行记录。</p> : null}
        {recent.map((item) => (
          <div key={item.id} className={styles.resultRow}>
            <strong>{skillLabel(item.skill)}</strong>
            <span>{item.summary}</span>
          </div>
        ))}
      </div>

      <div className={styles.inlineActions}>
        <button type="button" className={styles.panelButton} onClick={() => setExpanded((current) => !current)}>
          <Bot size={16} />
          {expanded ? '收起开通设置' : '开通 / 预算 / 授权'}
        </button>
      </div>

      {expanded ? (
        <div className={styles.actionModal} role="dialog" aria-modal="true" aria-label="代理开通设置">
          <button type="button" className={styles.actionModalScrim} aria-label="关闭代理设置" onClick={() => setExpanded(false)} />
          <div className={styles.actionModalSheet}>
            <div className={styles.actionModalHead}>
              <div>
                <span>代理设置</span>
                <strong>授权、预算、租约和风险控制</strong>
              </div>
              <button type="button" className={styles.modalCloseButton} onClick={() => setExpanded(false)} aria-label="关闭">
                <X size={16} />
              </button>
            </div>
            <div className={styles.actionModalBody}>
          <AutonomyPanel
            tokenId={companion.tokenId}
            ownerAddress={companion.ownerAddress}
            clwBalance={companion.routerClaworld}
            dailyCost={companion.dailyCost}
          />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TerminalMemoryPanel({
  companion,
  memoryCandidate,
  onReceipt,
}: {
  companion: ActiveCompanionValue;
  memoryCandidate?: string;
  onReceipt: (card: TerminalCard) => void;
}) {
  const { data: hash, error, isPending, writeContractAsync } = useWriteContract();
  const receiptQuery = useWaitForTransactionReceipt({ hash });
  const [text, setText] = useState(memoryCandidate ?? '');
  const [awaitingWallet, setAwaitingWallet] = useState(false);
  const [handledHash, setHandledHash] = useState<string | null>(null);

  useEffect(() => {
    if (memoryCandidate) setText(memoryCandidate);
  }, [memoryCandidate]);

  const trimmed = text.trim().slice(0, 500);
  const memoryRoot = trimmed ? keccak256(toBytes(`claworld-cml:${companion.tokenId.toString()}:${trimmed}`)) : null;

  async function writeMemoryRoot() {
    if (!memoryRoot || isPending || receiptQuery.isLoading) return;
    setAwaitingWallet(true);
    try {
      await writeContractAsync({
        address: addresses.clawNFA,
        abi: ClawNFAABI,
        functionName: 'updateLearningTreeByOwner',
        args: [companion.tokenId, memoryRoot],
      });
    } finally {
      setAwaitingWallet(false);
    }
  }

  useEffect(() => {
    if (!hash || handledHash === hash || !receiptQuery.data || !memoryRoot) return;
    setHandledHash(hash);
    onReceipt({
      id: `memory-receipt-${hash}`,
      type: 'receipt',
      label: '记忆已写入',
      title: '长期记忆已更新',
      body: '这段身份记忆已经压成 hash 写入学习树。原文不上链。',
      details: [
        { label: 'NFA', value: `#${companion.tokenNumber}` },
        { label: '记忆根', value: `${memoryRoot.slice(0, 10)}...${memoryRoot.slice(-6)}`, tone: 'growth' },
        { label: '交易', value: `${hash.slice(0, 10)}...`, tone: 'warm' },
      ],
      cta: { label: '查看交易', href: getBscScanTxUrl(hash) },
    });
  }, [companion.tokenNumber, handledHash, hash, memoryRoot, onReceipt, receiptQuery.data]);

  return (
    <section className={styles.inlinePanel}>
      <div className={styles.inlineHead}>
        <div>
          <span>长期记忆</span>
          <strong>确认一句话，写进学习树</strong>
        </div>
        <Brain size={18} />
      </div>

      <label className={styles.compactField}>
        <span>记忆内容</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, 500))}
          rows={4}
          className={styles.compactTextarea}
          placeholder="例如：以后叫我船长。你说话短一点，像真的在旁边陪我。"
        />
      </label>

      <div className={styles.inlineSummary}>
        <div>
          <span>写入方式</span>
          <strong>CML hash</strong>
        </div>
        <div>
          <span>原文</span>
          <strong>不上链</strong>
        </div>
        <div>
          <span>长度</span>
          <strong>{trimmed.length}/500</strong>
        </div>
        <div>
          <span>记忆根</span>
          <strong>{memoryRoot ? `${memoryRoot.slice(0, 8)}...` : '--'}</strong>
        </div>
      </div>

      <div className={styles.inlineActions}>
        <button
          type="button"
          className={styles.primaryPanelButton}
          onClick={() => void writeMemoryRoot()}
          disabled={!memoryRoot || isPending || receiptQuery.isLoading}
        >
          <Brain size={16} />
          {awaitingWallet ? '等待钱包确认' : receiptQuery.isLoading ? '链上确认中' : '写入记忆'}
        </button>
        <span className={styles.actionHint}>确认后才上链</span>
      </div>

      {error ? <p className={styles.panelError}>{error instanceof Error ? error.message : '写入失败'}</p> : null}
      {hash ? (
        <a className={styles.panelLink} href={getBscScanTxUrl(hash)} target="_blank" rel="noreferrer">
          查看交易 {hash.slice(0, 10)}...
        </a>
      ) : null}
    </section>
  );
}

function TerminalMintPanel({ onClose }: { onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className={styles.inlinePanel}>
      <div className={styles.inlineHead}>
        <div>
          <span>铸造</span>
          <strong>生成新的龙虾伙伴</strong>
        </div>
        <button type="button" className={styles.panelButton} onClick={onClose}>
          <X size={14} />
          收起
        </button>
      </div>
      <div className={styles.actionHero}>
        <div>
          <span>结果</span>
          <strong>获得新 NFA</strong>
        </div>
        <p>支付后等待揭示，完成后会出现在左侧列表。</p>
      </div>
      <div className={styles.inlineActions}>
        <button type="button" className={styles.primaryPanelButton} onClick={() => setExpanded((current) => !current)}>
          <Trophy size={16} />
          {expanded ? '收起铸造流程' : '打开铸造流程'}
        </button>
      </div>
      {expanded ? (
        <div className={styles.actionModal} role="dialog" aria-modal="true" aria-label="铸造流程">
          <button type="button" className={styles.actionModalScrim} aria-label="关闭铸造流程" onClick={() => setExpanded(false)} />
          <div className={styles.actionModalSheet}>
            <div className={styles.actionModalHead}>
              <div>
                <span>铸造流程</span>
                <strong>付款、等待揭示、接入终端</strong>
              </div>
              <button type="button" className={styles.modalCloseButton} onClick={() => setExpanded(false)} aria-label="关闭">
                <X size={16} />
              </button>
            </div>
            <div className={styles.actionModalBody}>
              <MintPanel />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function TerminalActionPanel({
  action,
  companion,
  memoryCandidate,
  onClose,
  onReceipt,
}: {
  action: TerminalActionIntent;
  companion: ActiveCompanionValue;
  memoryCandidate?: string;
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
  if (action === 'memory') {
    return (
      <div className={styles.actionPanelWrap}>
        <TerminalMemoryPanel companion={companion} memoryCandidate={memoryCandidate} onReceipt={onReceipt} />
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
