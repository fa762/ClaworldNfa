'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  Plus,
  RefreshCw,
  Shield,
  Swords,
  TimerReset,
} from 'lucide-react';
import { decodeEventLog, parseEther, type Address } from 'viem';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { PKSkillABI } from '@/contracts/abis/PKSkill';
import { getBscScanTxUrl } from '@/contracts/addresses';
import {
  generateCommit,
  loadPKResolutionCache,
  loadPKSalt,
  pkCancelArgs,
  pkCreateArgs,
  pkJoinArgs,
  pkRevealArgs,
  pkSettleArgs,
  savePKResolutionCache,
  savePKSalt,
  syncPKAutoReveal,
  type CachedPKResolution,
} from '@/game/chain/contracts';
import { loadMatchResolution, loadRecentMatches, type PKMatch } from '@/game/chain/wallet';
import { formatCLW } from '@/lib/format';
import type { TerminalCard } from '@/lib/terminal-cards';

type StrategyValue = 0 | 1 | 2;
type MatchWithResolution = PKMatch & { resolution: CachedPKResolution | null };
type ArenaMode = 'browse' | 'join' | 'create';
type ResultPanelState = {
  title: string;
  detail: string;
  reward?: string;
  tone: 'growth' | 'warm' | 'cool';
};
type PendingAction =
  | { kind: 'create'; stake: bigint; strategy: StrategyValue; commitHash: `0x${string}`; salt: `0x${string}` }
  | { kind: 'join'; matchId: number; strategy: StrategyValue; stake: bigint; commitHash: `0x${string}`; salt: `0x${string}` }
  | { kind: 'reveal'; matchId: number; strategy: StrategyValue; salt: `0x${string}` }
  | { kind: 'settle'; matchId: number }
  | { kind: 'cancel'; matchId: number; phase: number };

const COMMIT_TIMEOUT_SECONDS = 60 * 60;
const REVEAL_TIMEOUT_SECONDS = 30 * 60;

const STRATEGIES: Array<{ value: StrategyValue; label: string; note: string; tone: string }> = [
  { value: 0, label: '强攻', note: '赌爆发', tone: 'cw-card--warning' },
  { value: 1, label: '均衡', note: '稳一点', tone: 'cw-card--watch' },
  { value: 2, label: '防守', note: '少失误', tone: 'cw-card--safe' },
];

const PHASE_LABELS = ['等待应战', '已匹配', '等待亮招', '可结算', '已结算', '已清局'] as const;

function parseStakeInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return parseEther(trimmed);
  } catch {
    return null;
  }
}

function phaseLabel(phase: number) {
  return PHASE_LABELS[phase] ?? `阶段 ${phase}`;
}

function formatPkRemaining(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) return `${hours}小时${minutes}分`;
  if (minutes > 0) return `${minutes}分${secs}秒`;
  return `${secs}秒`;
}

function matchResultLabel(match: MatchWithResolution, tokenNumber: number) {
  if (!match.resolution) return phaseLabel(match.phase);
  if (match.resolution.type === 'cancelled') return '已清局';
  return match.resolution.winnerNfaId === tokenNumber ? '胜' : '败';
}

function toBigIntString(value: unknown) {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return BigInt(value).toString();
  if (typeof value === 'string') return BigInt(value).toString();
  return '0';
}

function pkError(error: unknown) {
  if (!(error instanceof Error)) return 'PK 操作失败。';
  const message = error.message;
  if (message.includes('User rejected') || message.includes('OKX Wallet Reject')) return '钱包取消了这次签名。';
  if (message.includes('Not NFA owner')) return '当前钱包不是这只龙虾的持有人。';
  if (message.includes('Match not open') || message.includes('Not open')) return '这场 PK 已经不能加入了。';
  if (message.includes('Already joined')) return '这只龙虾已经在 PK 对局里。';
  if (message.includes('Invalid reveal')) return '本地亮招凭据不匹配。';
  if (message.includes('Empty commit')) return '提交凭据没有生成成功，请重试。';
  if (message.includes('Insufficient CLW')) return '当前储备不足。';
  if (message.includes('execution reverted: 0x')) return '当前这条 PK 链路没有通过主网预检。';
  return message;
}

function decodePkEvent(
  receipt: { logs: readonly { address: string; data: `0x${string}`; topics: readonly `0x${string}`[] }[] },
  eventName: string,
) {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: PKSkillABI,
        data: log.data,
        topics: log.topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
      });
      if (decoded.eventName === eventName) return decoded.args as Record<string, unknown>;
    } catch {}
  }
  return null;
}

export function PKArenaPanel({
  tokenId,
  ownerAddress,
  companionName,
  reserve,
  reserveText,
  pkWins,
  pkLosses,
  pkWinRate,
  level,
  traits,
  onTerminalReceipt,
}: {
  tokenId?: bigint;
  ownerAddress?: Address;
  companionName: string;
  reserve: bigint;
  reserveText: string;
  pkWins: number;
  pkLosses: number;
  pkWinRate: number;
  level: number;
  traits: { courage: number; wisdom: number; social: number; create: number; grit: number };
  onTerminalReceipt?: (card: TerminalCard) => void;
}) {
  const { address } = useAccount();
  const { data: hash, error, isPending, writeContractAsync } = useWriteContract();
  const receiptQuery = useWaitForTransactionReceipt({ hash });

  const [matches, setMatches] = useState<MatchWithResolution[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<ArenaMode>('browse');
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [createStakeInput, setCreateStakeInput] = useState('');
  const [createStrategy, setCreateStrategy] = useState<StrategyValue>(1);
  const [joinStrategy, setJoinStrategy] = useState<StrategyValue>(1);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [resultPanel, setResultPanel] = useState<ResultPanelState | null>(null);
  const [saltVersion, setSaltVersion] = useState(0);
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));

  const tokenNumber = tokenId ? Number(tokenId) : 0;
  const ownerConnected =
    Boolean(address && ownerAddress) && address!.toLowerCase() === ownerAddress!.toLowerCase();

  const suggestedStake = useMemo(() => {
    const base = Math.round(traits.courage * 0.18 + traits.grit * 0.12 + level * 4);
    const reserveCap = reserve > 0n ? Number((reserve / 5n) / 10n ** 18n) : base;
    return String(Math.max(12, Math.min(Math.max(12, reserveCap || base), base)));
  }, [level, reserve, traits.courage, traits.grit]);

  useEffect(() => {
    setCreateStakeInput(suggestedStake);
  }, [suggestedStake, tokenId]);

  const refreshMatches = useCallback(async () => {
    if (!tokenId) {
      setMatches([]);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const recent = await loadRecentMatches({ includeClosed: true, maxCount: 12 });
      const enriched = await Promise.all(
        recent.map(async (match) => {
          let resolution = loadPKResolutionCache(match.matchId);
          if (!resolution && match.phase >= 4) {
            const settled = await loadMatchResolution(match.matchId, match.phaseTimestamp);
            if (settled?.type === 'settled') {
              resolution = {
                type: 'settled',
                matchId: settled.matchId,
                winnerNfaId: settled.winnerNfaId,
                loserNfaId: settled.loserNfaId,
                reward: settled.reward.toString(),
                burned: settled.burned.toString(),
                txHash: settled.transactionHash,
                ts: Date.now(),
              };
              savePKResolutionCache(resolution);
            } else if (settled?.type === 'cancelled') {
              resolution = {
                type: 'cancelled',
                matchId: settled.matchId,
                txHash: settled.transactionHash,
                ts: Date.now(),
              };
              savePKResolutionCache(resolution);
            }
          }
          return { ...match, resolution: resolution ?? null };
        }),
      );
      setMatches(enriched);
    } catch (nextError) {
      setLoadError(pkError(nextError));
    } finally {
      setIsLoading(false);
    }
  }, [tokenId]);

  useEffect(() => {
    void refreshMatches();
  }, [refreshMatches]);

  const activeMatch = useMemo(
    () =>
      matches.find((match) => (match.nfaA === tokenNumber || match.nfaB === tokenNumber) && match.phase < 4) ??
      null,
    [matches, tokenNumber],
  );
  const joinableMatches = useMemo(
    () => matches.filter((match) => match.phase === 0 && match.nfaA !== tokenNumber && match.nfaB === 0),
    [matches, tokenNumber],
  );
  const recentResults = useMemo(
    () =>
      matches
        .filter((match) => match.phase >= 4 || match.resolution)
        .slice(0, 3),
    [matches],
  );
  const selectedMatch = joinableMatches.find((match) => match.matchId === selectedMatchId) ?? null;
  const savedReveal = useMemo(
    () => (activeMatch ? loadPKSalt(activeMatch.matchId) : null),
    [activeMatch, saltVersion],
  );
  const cancelState = useMemo(() => {
    if (!activeMatch) return null;

    if (activeMatch.phase === 0 && activeMatch.nfaA === tokenNumber && activeMatch.nfaB === 0) {
      return {
        canCancel: true,
        label: '取消擂台',
        detail: '这场擂台还没人应战，现在可以直接取消。',
      };
    }

    if (activeMatch.phase === 1) {
      const remaining = activeMatch.phaseTimestamp + COMMIT_TIMEOUT_SECONDS - nowTs;
      return {
        canCancel: remaining <= 0,
        label: '超时清局',
        detail: remaining > 0 ? `还要等 ${formatPkRemaining(remaining)} 才能取消。` : '对手超时未提交，你现在可以清局并拿回质押。',
      };
    }

    if (activeMatch.phase === 2) {
      const remaining = activeMatch.phaseTimestamp + REVEAL_TIMEOUT_SECONDS - nowTs;
      return {
        canCancel: remaining <= 0,
        label: '超时清局',
        detail: remaining > 0 ? `还要等 ${formatPkRemaining(remaining)} 才能取消。` : '对手超时未揭示，你现在可以清局并拿回质押。',
      };
    }

    return null;
  }, [activeMatch, nowTs, tokenNumber]);

  useEffect(() => {
    if (!selectedMatchId) return;
    if (!joinableMatches.some((match) => match.matchId === selectedMatchId)) {
      setSelectedMatchId(null);
      setMode('browse');
    }
  }, [joinableMatches, selectedMatchId]);

  useEffect(() => {
    if (!activeMatch || activeMatch.phase > 2) return;
    const timer = window.setInterval(() => {
      setNowTs(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeMatch]);

  async function submitCreate() {
    if (!tokenId || !ownerConnected) return;
    const stake = parseStakeInput(createStakeInput);
    if (!stake || stake <= 0n) {
      setActionError('请输入有效的质押数。');
      return;
    }
    if (reserve < stake) {
      setActionError('当前储备不足。');
      return;
    }
    const { commitHash, salt } = generateCommit(createStrategy, address as Address);
    setActionError(null);
    setResultText(null);
    setResultPanel(null);
    setPendingAction({ kind: 'create', stake, strategy: createStrategy, commitHash, salt });
    try {
      await writeContractAsync(pkCreateArgs(tokenNumber, stake, commitHash));
    } catch (nextError) {
      setPendingAction(null);
      setActionError(pkError(nextError));
    }
  }

  async function submitJoin() {
    if (!tokenId || !selectedMatch || !ownerConnected) return;
    if (reserve < selectedMatch.stake) {
      setActionError('当前储备不足。');
      return;
    }
    const { commitHash, salt } = generateCommit(joinStrategy, address as Address);
    setActionError(null);
    setResultText(null);
    setResultPanel(null);
    setPendingAction({
      kind: 'join',
      matchId: selectedMatch.matchId,
      strategy: joinStrategy,
      stake: selectedMatch.stake,
      commitHash,
      salt,
    });
    try {
      await writeContractAsync(pkJoinArgs(selectedMatch.matchId, tokenNumber, commitHash));
    } catch (nextError) {
      setPendingAction(null);
      setActionError(pkError(nextError));
    }
  }

  async function submitSimple(action: PendingAction) {
    setActionError(null);
    setResultText(null);
    setResultPanel(null);
    setPendingAction(action);
    try {
      if (action.kind === 'reveal') {
        await writeContractAsync(pkRevealArgs(action.matchId, action.strategy, action.salt));
      } else if (action.kind === 'settle') {
        await writeContractAsync(pkSettleArgs(action.matchId));
      } else if (action.kind === 'cancel') {
        await writeContractAsync(pkCancelArgs(action.matchId, action.phase));
      }
    } catch (nextError) {
      setPendingAction(null);
      setActionError(pkError(nextError));
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function onReceipt() {
      if (!receiptQuery.data || !pendingAction) return;
      const txHash = receiptQuery.data.transactionHash;
      const emitReceipt = (card: Omit<Extract<TerminalCard, { type: 'receipt' }>, 'id' | 'type' | 'cta'>) => {
        onTerminalReceipt?.({
          ...card,
          id: `pk-receipt-${pendingAction.kind}-${txHash}`,
          type: 'receipt',
          cta: { label: '查看交易', href: getBscScanTxUrl(txHash) },
        });
      };

      if (pendingAction.kind === 'create') {
        const created = decodePkEvent(receiptQuery.data, 'MatchCreated');
        const matchId = Number(created?.matchId ?? 0);
        if (matchId > 0) {
          savePKSalt(matchId, pendingAction.strategy, pendingAction.salt, tokenNumber);
          setSaltVersion((value) => value + 1);
          try {
            await syncPKAutoReveal({
              matchId,
              nfaId: tokenNumber,
              strategy: pendingAction.strategy,
              salt: pendingAction.salt,
              walletAddress: address as Address,
            });
          } catch {}
          if (!cancelled) {
            setResultText(`PK #${matchId} 已开擂。`);
            setResultPanel({
              title: `PK #${matchId} 已开擂`,
              detail: '你的策略已经锁定，先等别人应战；一旦配对完成，后续亮招和结算会继续推进。',
              reward: formatCLW(pendingAction.stake),
              tone: 'warm',
            });
            emitReceipt({
              label: 'PK 回执',
              title: `PK #${matchId} 已开擂`,
              body: `质押 ${formatCLW(pendingAction.stake)} Claworld，策略 ${STRATEGIES.find((item) => item.value === pendingAction.strategy)?.label ?? '已锁定'}。`,
              details: [
                { label: '动作', value: '开擂', tone: 'warm' },
                { label: '质押', value: `${formatCLW(pendingAction.stake)} Claworld`, tone: 'growth' },
                { label: '策略', value: STRATEGIES.find((item) => item.value === pendingAction.strategy)?.label ?? '已锁定' },
                { label: '交易', value: `${txHash.slice(0, 10)}...`, tone: 'cool' },
              ],
            });
          }
        }
      } else if (pendingAction.kind === 'join') {
        savePKSalt(pendingAction.matchId, pendingAction.strategy, pendingAction.salt, tokenNumber);
        setSaltVersion((value) => value + 1);
        try {
          await syncPKAutoReveal({
            matchId: pendingAction.matchId,
            nfaId: tokenNumber,
            strategy: pendingAction.strategy,
            salt: pendingAction.salt,
            walletAddress: address as Address,
          });
        } catch {}
        if (!cancelled) {
          setResultText(`已加入 PK #${pendingAction.matchId}。`);
          setResultPanel({
            title: `已加入 PK #${pendingAction.matchId}`,
            detail: '这局已经锁定，策略也保存好了。接下来等双方亮招并推进结算。',
            reward: formatCLW(pendingAction.stake),
            tone: 'warm',
          });
          emitReceipt({
            label: 'PK 回执',
            title: `已加入 PK #${pendingAction.matchId}`,
            body: `质押 ${formatCLW(pendingAction.stake)} Claworld，策略 ${STRATEGIES.find((item) => item.value === pendingAction.strategy)?.label ?? '已锁定'}。`,
            details: [
              { label: '动作', value: '应战', tone: 'warm' },
              { label: '质押', value: `${formatCLW(pendingAction.stake)} Claworld`, tone: 'growth' },
              { label: '策略', value: STRATEGIES.find((item) => item.value === pendingAction.strategy)?.label ?? '已锁定' },
              { label: '交易', value: `${txHash.slice(0, 10)}...`, tone: 'cool' },
            ],
          });
        }
      } else if (pendingAction.kind === 'reveal') {
        if (!cancelled) {
          setResultText(`PK #${pendingAction.matchId} 已亮招。`);
          setResultPanel({
            title: `PK #${pendingAction.matchId} 已亮招`,
            detail: '你的出招已经上链，接下来只等结算结果。',
            tone: 'cool',
          });
          emitReceipt({
            label: 'PK 回执',
            title: `PK #${pendingAction.matchId} 已亮招`,
            body: `亮出策略 ${STRATEGIES.find((item) => item.value === pendingAction.strategy)?.label ?? '已提交'}，等待结算。`,
            details: [
              { label: '动作', value: '亮招', tone: 'cool' },
              { label: '策略', value: STRATEGIES.find((item) => item.value === pendingAction.strategy)?.label ?? '已提交' },
              { label: '状态', value: '等结算' },
              { label: '交易', value: `${txHash.slice(0, 10)}...`, tone: 'warm' },
            ],
          });
        }
      } else if (pendingAction.kind === 'settle') {
        const settled = decodePkEvent(receiptQuery.data, 'MatchSettled');
        const winnerNfaId = Number(settled?.winner ?? 0);
        const rewardText = settled?.reward ? formatCLW(BigInt(toBigIntString(settled.reward))) : undefined;
        if (settled?.matchId) {
          savePKResolutionCache({
            type: 'settled',
            matchId: Number(settled.matchId),
            winnerNfaId,
            loserNfaId: Number(settled.loser ?? 0),
            reward: toBigIntString(settled.reward),
            burned: toBigIntString(settled.burned),
            txHash,
            ts: Date.now(),
          });
        }
        if (!cancelled) {
          setResultText(`PK #${pendingAction.matchId} 已结算。`);
          setResultPanel({
            title: winnerNfaId === tokenNumber ? `PK #${pendingAction.matchId} 胜利` : `PK #${pendingAction.matchId} 结算完成`,
            detail:
              winnerNfaId === tokenNumber
                ? '你拿下了这一局，奖励已经回到这只龙虾的记账账户。'
                : '这一局已经结算完成，可以继续看下一场。',
            reward: rewardText,
            tone: winnerNfaId === tokenNumber ? 'growth' : 'cool',
          });
          emitReceipt({
            label: 'PK 回执',
            title: winnerNfaId === tokenNumber ? `PK #${pendingAction.matchId} 胜利` : `PK #${pendingAction.matchId} 已结算`,
            body:
              winnerNfaId === tokenNumber
                ? `赢了，奖励 ${rewardText ?? '--'} Claworld 已回到记账账户。`
                : `这一局结算完成，赢家是 #${winnerNfaId || '--'}。`,
            details: [
              { label: '动作', value: '结算', tone: 'cool' },
              { label: '赢家', value: winnerNfaId ? `#${winnerNfaId}` : '--', tone: winnerNfaId === tokenNumber ? 'growth' : 'warm' },
              { label: '奖励', value: rewardText ? `${rewardText} Claworld` : '--', tone: rewardText ? 'growth' : 'cool' },
              { label: '交易', value: `${txHash.slice(0, 10)}...`, tone: 'warm' },
            ],
          });
        }
      } else if (pendingAction.kind === 'cancel') {
        savePKResolutionCache({
          type: 'cancelled',
          matchId: pendingAction.matchId,
          txHash,
          ts: Date.now(),
        });
        if (!cancelled) {
          setResultText(`PK #${pendingAction.matchId} 已清局。`);
          setResultPanel({
            title: `PK #${pendingAction.matchId} 已清局`,
            detail: '这一局已经结束，质押会按规则退回。',
            tone: 'cool',
          });
          emitReceipt({
            label: 'PK 回执',
            title: `PK #${pendingAction.matchId} 已清局`,
            body: '对局已取消或超时清局，质押按合约规则退回。',
            details: [
              { label: '动作', value: '清局', tone: 'cool' },
              { label: '状态', value: '已结束' },
              { label: '交易', value: `${txHash.slice(0, 10)}...`, tone: 'warm' },
            ],
          });
        }
      }

      if (!cancelled) {
        setPendingAction(null);
        void refreshMatches();
      }
    }

    void onReceipt();
    return () => {
      cancelled = true;
    };
  }, [address, onTerminalReceipt, pendingAction, receiptQuery.data, refreshMatches, tokenNumber]);

  return (
    <div className="cw-page">
      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">当前状态</span>
            <h3>{activeMatch ? `PK #${activeMatch.matchId}` : '当前空闲'}</h3>
          </div>
          <span className={`cw-chip ${activeMatch ? 'cw-chip--warm' : 'cw-chip--cool'}`}>
            <Swords size={14} />
            {activeMatch ? phaseLabel(activeMatch.phase) : '可开擂'}
          </span>
        </div>

        <div className="cw-state-grid">
          <div className="cw-state-card">
            <span className="cw-label">储备</span>
            <strong>{reserveText}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">胜败</span>
            <strong>{pkWins}胜 / {pkLosses}败</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">状态</span>
            <strong>{activeMatch ? phaseLabel(activeMatch.phase) : '待机'}</strong>
          </div>
        </div>

        <div className="cw-rule-strip">
          <div className="cw-rule-copy">
            <span className="cw-label">对局规则</span>
            <strong>{activeMatch ? '亮招后见真章，赢的人拿走这一局。' : '一对一锁注，先藏招，后亮招，赢者拿走整局。'}</strong>
          </div>
          <div className="cw-pill-row">
            <span className="cw-chip cw-chip--warm">{pkWinRate}% 胜率</span>
            <span className="cw-chip cw-chip--cool">押注来自储备</span>
            <span className="cw-chip cw-chip--growth">亮招自动保存</span>
          </div>
        </div>

        {activeMatch ? (
          <>
            <div className="cw-stage-stats">
              <div className="cw-mini-stat">
                <span>对手</span>
                <strong>#{activeMatch.nfaA === tokenNumber ? activeMatch.nfaB : activeMatch.nfaA || '--'}</strong>
              </div>
              <div className="cw-mini-stat">
                <span>质押</span>
                <strong>{formatCLW(activeMatch.stake)}</strong>
              </div>
              <div className="cw-mini-stat">
                <span>亮招</span>
                <strong>{savedReveal ? STRATEGIES.find((item) => item.value === savedReveal.strategy)?.label ?? '已保存' : '未保存'}</strong>
              </div>
            </div>

            {cancelState ? (
              <div className={`cw-list-item ${cancelState.canCancel ? 'cw-list-item--warm' : 'cw-list-item--cool'}`}>
                <TimerReset size={16} />
                <span>{cancelState.detail}</span>
              </div>
            ) : null}

            <div className="cw-button-row">
              {activeMatch.phase === 2 && savedReveal?.salt ? (
                <button
                  type="button"
                  className="cw-button cw-button--primary"
                  onClick={() =>
                    submitSimple({
                      kind: 'reveal',
                      matchId: activeMatch.matchId,
                      strategy: savedReveal.strategy as StrategyValue,
                      salt: savedReveal.salt as `0x${string}`,
                    })
                  }
                >
                  <Eye size={16} />
                  亮招
                </button>
              ) : null}
              {activeMatch.phase === 3 ? (
                <button
                  type="button"
                  className="cw-button cw-button--secondary"
                  onClick={() => submitSimple({ kind: 'settle', matchId: activeMatch.matchId })}
                >
                  <CheckCircle2 size={16} />
                  结算
                </button>
              ) : null}
              {cancelState ? (
                <button
                  type="button"
                  className="cw-button cw-button--ghost"
                  disabled={!cancelState.canCancel}
                  onClick={() =>
                    submitSimple({ kind: 'cancel', matchId: activeMatch.matchId, phase: activeMatch.phase })
                  }
                >
                  <TimerReset size={16} />
                  {cancelState.label}
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </section>

      {!activeMatch ? (
        <>
          {mode === 'browse' ? (
            <section className="cw-panel cw-panel--warm">
              <div className="cw-section-head">
                <div>
                  <span className="cw-label">应战列表</span>
                  <h3>{joinableMatches.length > 0 ? `当前有 ${joinableMatches.length} 场可应战` : '当前没有公开对局'}</h3>
                </div>
                <button type="button" className="cw-button cw-button--ghost" onClick={() => void refreshMatches()} disabled={isLoading}>
                  <RefreshCw size={16} className={isLoading ? 'cw-spin' : ''} />
                  {isLoading ? '刷新中' : '刷新'}
                </button>
              </div>

              {joinableMatches.length > 0 ? (
                <>
                  <div className="cw-match-list">
                    {joinableMatches.map((match) => (
                      <button
                        key={match.matchId}
                        type="button"
                        className={`cw-match-row ${selectedMatch?.matchId === match.matchId ? 'cw-match-row--selected' : ''}`}
                        onClick={() => {
                          setSelectedMatchId(match.matchId);
                          setMode('join');
                          setActionError(null);
                          setResultText(null);
                        }}
                      >
                        <div className="cw-match-row-copy">
                          <span className="cw-label">PK #{match.matchId}</span>
                          <strong>对手 #{match.nfaA}</strong>
                        </div>
                        <div className="cw-match-row-meta">
                          <strong>{formatCLW(match.stake)}</strong>
                          <span>{selectedMatch?.matchId === match.matchId ? '已选中' : '点我应战'}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="cw-button-row">
                    <button
                      type="button"
                      className="cw-button cw-button--ghost"
                      onClick={() => {
                        setMode('create');
                        setSelectedMatchId(null);
                        setActionError(null);
                      }}
                    >
                      <Plus size={16} />
                      我要开擂
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="cw-list">
                    <div className="cw-list-item cw-list-item--cool">
                      <Shield size={16} />
                      <span>现在没有可应战的公开 PK，你可以自己开擂。</span>
                    </div>
                  </div>
                  <div className="cw-button-row">
                    <button
                      type="button"
                      className="cw-button cw-button--primary"
                      onClick={() => {
                        setMode('create');
                        setActionError(null);
                      }}
                    >
                      <Plus size={16} />
                      我要开擂
                    </button>
                  </div>
                </>
              )}
            </section>
          ) : null}

          {mode === 'join' && selectedMatch ? (
            <section className="cw-sheet">
              <div className="cw-sheet-head">
                <div>
                  <span className="cw-label">应战确认</span>
                  <h3>PK #{selectedMatch.matchId}</h3>
                </div>
                <button type="button" className="cw-icon-button cw-sheet-close" onClick={() => setMode('browse')} aria-label="返回">
                  <TimerReset size={16} />
                </button>
              </div>

              <div className="cw-detail-list">
                <div className="cw-detail-row">
                  <span>对手</span>
                  <strong>#{selectedMatch.nfaA}</strong>
                </div>
                <div className="cw-detail-row">
                  <span>质押</span>
                  <strong>{formatCLW(selectedMatch.stake)}</strong>
                </div>
                <div className="cw-detail-row">
                  <span>伙伴</span>
                  <strong>{companionName}</strong>
                </div>
              </div>

              <div className="cw-choice-grid">
                {STRATEGIES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`cw-choice-card ${item.tone} ${joinStrategy === item.value ? 'cw-choice-card--selected' : ''}`}
                    onClick={() => setJoinStrategy(item.value)}
                  >
                    <span>{item.label}</span>
                    <strong>{item.note}</strong>
                  </button>
                ))}
              </div>

              <div className="cw-button-row">
                <button
                  type="button"
                  className="cw-button cw-button--primary"
                  disabled={!ownerConnected || reserve < selectedMatch.stake}
                  onClick={() => void submitJoin()}
                >
                  <Swords size={16} />
                  提交这一步
                </button>
                <button type="button" className="cw-button cw-button--ghost" onClick={() => setMode('browse')}>
                  返回上一层
                </button>
              </div>
            </section>
          ) : null}

          {mode === 'create' ? (
            <section className="cw-sheet">
              <div className="cw-sheet-head">
                <div>
                  <span className="cw-label">开擂</span>
                  <h3>定一笔质押，等别人来应战</h3>
                </div>
                <button type="button" className="cw-icon-button cw-sheet-close" onClick={() => setMode('browse')} aria-label="返回">
                  <TimerReset size={16} />
                </button>
              </div>

              <label className="cw-field">
                <span className="cw-label">质押数</span>
                <input
                  className="cw-input"
                  inputMode="decimal"
                  value={createStakeInput}
                  onChange={(event) => setCreateStakeInput(event.target.value)}
                  placeholder="50"
                />
              </label>

              <div className="cw-choice-grid">
                {STRATEGIES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`cw-choice-card ${item.tone} ${createStrategy === item.value ? 'cw-choice-card--selected' : ''}`}
                    onClick={() => setCreateStrategy(item.value)}
                  >
                    <span>{item.label}</span>
                    <strong>{item.note}</strong>
                  </button>
                ))}
              </div>

              <div className="cw-button-row">
                <button
                  type="button"
                  className="cw-button cw-button--primary"
                  disabled={!ownerConnected}
                  onClick={() => void submitCreate()}
                >
                  <Swords size={16} />
                  开擂
                </button>
                <button type="button" className="cw-button cw-button--ghost" onClick={() => setMode('browse')}>
                  返回上一层
                </button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {recentResults.length > 0 ? (
        <section className="cw-panel cw-panel--cool">
          <div className="cw-section-head">
            <div>
              <span className="cw-label">最近结果</span>
              <h3>最近三场</h3>
            </div>
          </div>
          <div className="cw-card-stack">
            {recentResults.map((match) => (
              <div key={match.matchId} className={`cw-card ${matchResultLabel(match, tokenNumber) === '胜' ? 'cw-card--ready' : matchResultLabel(match, tokenNumber) === '败' ? 'cw-card--warning' : 'cw-card--safe'}`}>
                <div className="cw-card-copy">
                  <p className="cw-label">PK #{match.matchId}</p>
                  <h3>{matchResultLabel(match, tokenNumber)}</h3>
                </div>
                <div className="cw-score">
                  <strong>{formatCLW(match.stake)}</strong>
                  <span>{phaseLabel(match.phase)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {(loadError || actionError || error || isPending || receiptQuery.isLoading || resultText) ? (
        <div className="cw-list">
          {loadError ? (
            <div className="cw-list-item cw-list-item--alert">
              <AlertTriangle size={16} />
              <span>{loadError}</span>
            </div>
          ) : null}
          {isPending ? (
            <div className="cw-list-item cw-list-item--warm">
              <Shield size={16} />
              <span>请去钱包确认这一步 PK 交易。</span>
            </div>
          ) : null}
          {receiptQuery.isLoading ? (
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>交易已发出，正在等待链上回执。</span>
            </div>
          ) : null}
          {resultText ? (
            <div className="cw-list-item cw-list-item--growth">
              <CheckCircle2 size={16} />
              <span>{resultText}</span>
            </div>
          ) : null}
          {actionError ? (
            <div className="cw-list-item cw-list-item--alert">
              <AlertTriangle size={16} />
              <span>{actionError}</span>
            </div>
          ) : null}
          {error && !actionError ? (
            <div className="cw-list-item cw-list-item--alert">
              <AlertTriangle size={16} />
              <span>{pkError(error)}</span>
            </div>
          ) : null}
          {hash ? (
            <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="cw-inline-link">
              查看交易 <ArrowUpRight size={14} />
            </a>
          ) : null}
        </div>
      ) : null}

      {resultPanel ? (
        <section className="cw-modal" aria-modal="true" role="dialog">
          <button
            type="button"
            className="cw-modal__scrim"
            aria-label="关闭"
            onClick={() => setResultPanel(null)}
          />
          <div className="cw-modal__sheet">
            <section className="cw-sheet">
              <div className="cw-sheet-head">
                <div>
                  <span className="cw-label">对局结果</span>
                  <h3>{resultPanel.title}</h3>
                </div>
                <button
                  type="button"
                  className="cw-icon-button cw-sheet-close"
                  onClick={() => setResultPanel(null)}
                  aria-label="关闭"
                >
                  <TimerReset size={16} />
                </button>
              </div>

              <div className={`cw-list-item ${resultPanel.tone === 'growth' ? 'cw-list-item--growth' : resultPanel.tone === 'warm' ? 'cw-list-item--warm' : 'cw-list-item--cool'}`}>
                <CheckCircle2 size={16} />
                <span>{resultPanel.detail}</span>
              </div>

              {resultPanel.reward ? (
                <div className="cw-detail-list">
                  <div className="cw-detail-row">
                    <span>本局金额</span>
                    <strong>{resultPanel.reward}</strong>
                  </div>
                </div>
              ) : null}

              <div className="cw-button-row">
                <button type="button" className="cw-button cw-button--primary" onClick={() => setResultPanel(null)}>
                  继续
                </button>
              </div>
            </section>
          </div>
        </section>
      ) : null}
    </div>
  );
}
