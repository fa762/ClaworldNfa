'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Shield,
  Sparkles,
  Swords,
  TimerReset,
} from 'lucide-react';
import { decodeEventLog, parseEther, type Address } from 'viem';
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';

import { PKSkillABI } from '@/contracts/abis/PKSkill';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
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
import {
  loadMatch,
  loadMatchResolution,
  loadRecentMatches,
  type PKMatch,
} from '@/game/chain/wallet';
import { formatBNB, formatCLW, truncateAddress } from '@/lib/format';

type StrategyValue = 0 | 1 | 2;

type MatchWithResolution = PKMatch & {
  resolution: CachedPKResolution | null;
};

type ConfirmIntent =
  | {
      action: 'create';
      strategy: StrategyValue;
      stake: bigint;
    }
  | {
      action: 'join';
      matchId: number;
      strategy: StrategyValue;
      stake: bigint;
      opponentNfaId: number;
    }
  | {
      action: 'reveal';
      matchId: number;
      strategy: StrategyValue;
      salt: `0x${string}`;
    }
  | {
      action: 'settle';
      matchId: number;
      timeoutPath: boolean;
    }
  | {
      action: 'cancel';
      matchId: number;
      phase: number;
    };

type SubmittedIntent =
  | (Extract<ConfirmIntent, { action: 'create' }> & {
      commitHash: `0x${string}`;
      salt: `0x${string}`;
    })
  | (Extract<ConfirmIntent, { action: 'join' }> & {
      commitHash: `0x${string}`;
      salt: `0x${string}`;
    })
  | Extract<ConfirmIntent, { action: 'reveal' | 'settle' | 'cancel' }>;

type PKResult =
  | {
      action: 'create' | 'join';
      matchId: number;
      txHash: `0x${string}`;
      strategy: StrategyValue;
      stake: bigint;
      relayState?: string;
      relayMessage?: string;
      relayTxHash?: `0x${string}`;
    }
  | {
      action: 'reveal';
      matchId: number;
      txHash: `0x${string}`;
      phase?: number;
      strategy: StrategyValue;
    }
  | {
      action: 'settle';
      matchId: number;
      txHash: `0x${string}`;
      winnerNfaId?: number;
      loserNfaId?: number;
      reward?: bigint;
      burned?: bigint;
      timeoutPath: boolean;
    }
  | {
      action: 'cancel';
      matchId: number;
      txHash: `0x${string}`;
    };

const pkSkillContract = {
  address: addresses.pkSkill,
  abi: PKSkillABI,
} as const;

const STRATEGIES: Array<{
  value: StrategyValue;
  label: string;
  detail: string;
  tone: 'cw-card--warning' | 'cw-card--watch' | 'cw-card--safe';
}> = [
  {
    value: 0,
    label: 'Attack',
    detail: 'Higher upside when the read is clean, with the most volatility.',
    tone: 'cw-card--warning',
  },
  {
    value: 1,
    label: 'Balanced',
    detail: 'Default line when you want fewer blind spots and cleaner reveal timing.',
    tone: 'cw-card--watch',
  },
  {
    value: 2,
    label: 'Defense',
    detail: 'Lower variance posture when reserve protection matters more than upside.',
    tone: 'cw-card--safe',
  },
] as const;

const PK_PHASE_NAMES = ['Open', 'Joined', 'Committed', 'Revealed', 'Settled', 'Cancelled'] as const;
const ZERO_HASH = `0x${'0'.repeat(64)}` as `0x${string}`;

function getPkErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'PK transaction failed.';
  if (error.message.includes('User rejected')) return 'Wallet signature was rejected.';
  if (error.message.includes('Not NFA owner')) return 'Connected wallet does not own this NFA.';
  if (error.message.includes('Already joined')) return 'This NFA is already tied to another live PK match.';
  if (error.message.includes('Invalid reveal')) return 'Saved strategy does not match the committed hash.';
  if (error.message.includes('Match not open')) return 'The selected match is no longer open.';
  if (error.message.includes('Match not found')) return 'The selected match could not be loaded.';
  return error.message;
}

function formatRemaining(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const parts = [
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
    hours === 0 ? `${secs}s` : null,
  ].filter(Boolean);
  return parts.join(' ') || '0s';
}

function phaseName(phase: number) {
  return PK_PHASE_NAMES[phase] ?? `Phase ${phase}`;
}

function parseStakeInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return parseEther(trimmed);
  } catch {
    return null;
  }
}

function parseCachedAmount(value: string | undefined) {
  if (!value) return 0n;
  try {
    return value.includes('.') ? parseEther(value) : BigInt(value);
  } catch {
    return 0n;
  }
}

function decodePkEvent(
  receipt: { logs: readonly { address: string; data: `0x${string}`; topics: readonly `0x${string}`[] }[] },
  eventName: string,
) {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== addresses.pkSkill.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: PKSkillABI,
        data: log.data,
        topics: log.topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
      });
      if (decoded.eventName === eventName) {
        return decoded.args as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function getStrategyLabel(strategy: StrategyValue) {
  return STRATEGIES.find((item) => item.value === strategy)?.label ?? 'Balanced';
}

export function PKArenaPanel({
  tokenId,
  ownerAddress,
  companionName,
  reserve,
  reserveText,
  level,
  traits,
}: {
  tokenId?: bigint;
  ownerAddress?: Address;
  companionName: string;
  reserve: bigint;
  reserveText: string;
  level: number;
  traits: {
    courage: number;
    wisdom: number;
    social: number;
    create: number;
    grit: number;
  };
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: hash, error, isPending, writeContractAsync } = useWriteContract();
  const receiptQuery = useWaitForTransactionReceipt({ hash });

  const [matches, setMatches] = useState<MatchWithResolution[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  const [submittedIntent, setSubmittedIntent] = useState<SubmittedIntent | null>(null);
  const [result, setResult] = useState<PKResult | null>(null);
  const [gasUnits, setGasUnits] = useState<bigint | null>(null);
  const [gasCostWei, setGasCostWei] = useState<bigint | null>(null);
  const [gasEstimateError, setGasEstimateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createStakeInput, setCreateStakeInput] = useState('');
  const [createStrategy, setCreateStrategy] = useState<StrategyValue>(1);
  const [joinStrategy, setJoinStrategy] = useState<StrategyValue>(1);
  const [selectedJoinMatchId, setSelectedJoinMatchId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [saltVersion, setSaltVersion] = useState(0);
  const [timeouts, setTimeouts] = useState({
    commit: 3600,
    reveal: 1800,
  });

  const ownerConnected =
    Boolean(address && ownerAddress) && address!.toLowerCase() === ownerAddress!.toLowerCase();

  const tokenNumber = tokenId !== undefined ? Number(tokenId) : 0;

  const recommendedStake = useMemo(() => {
    const suggested = Math.round(traits.courage * 0.18 + traits.grit * 0.12 + level * 4);
    const reserveCap = reserve > 0n ? Number((reserve / 5n) / 10n ** 18n) : suggested;
    return String(Math.max(12, Math.min(Math.max(12, reserveCap || suggested), suggested)));
  }, [level, reserve, traits.courage, traits.grit]);

  useEffect(() => {
    setCreateStakeInput(recommendedStake);
  }, [recommendedStake, tokenId]);

  const refreshMatches = useCallback(async () => {
    if (tokenId === undefined) {
      setMatches([]);
      setLoadError(null);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const recent = await loadRecentMatches({ includeClosed: true, maxCount: 10 });
      const enriched = await Promise.all(
        recent.map(async (match) => {
          let resolution = loadPKResolutionCache(match.matchId);
          if (!resolution && match.phase >= 4) {
            const resolved = await loadMatchResolution(match.matchId, match.phaseTimestamp);
            if (resolved?.type === 'settled') {
              resolution = {
                type: 'settled',
                matchId: resolved.matchId,
                winnerNfaId: resolved.winnerNfaId,
                loserNfaId: resolved.loserNfaId,
                reward: resolved.reward.toString(),
                burned: resolved.burned.toString(),
                txHash: resolved.transactionHash,
                ts: Date.now(),
              };
              savePKResolutionCache(resolution);
            } else if (resolved?.type === 'cancelled') {
              resolution = {
                type: 'cancelled',
                matchId: resolved.matchId,
                txHash: resolved.transactionHash,
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
      setLoadError((nextError as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [tokenId]);

  useEffect(() => {
    void refreshMatches();
  }, [refreshMatches]);

  useEffect(() => {
    let cancelled = false;

    async function loadTimeouts() {
      if (!publicClient) return;
      try {
        const [commitTimeout, revealTimeout] = await Promise.all([
          publicClient.readContract({
            ...pkSkillContract,
            functionName: 'COMMIT_TIMEOUT',
          }),
          publicClient.readContract({
            ...pkSkillContract,
            functionName: 'REVEAL_TIMEOUT',
          }),
        ]);

        if (!cancelled) {
          setTimeouts({
            commit: Number(commitTimeout),
            reveal: Number(revealTimeout),
          });
        }
      } catch {
        if (!cancelled) {
          setTimeouts({
            commit: 3600,
            reveal: 1800,
          });
        }
      }
    }

    void loadTimeouts();
    return () => {
      cancelled = true;
    };
  }, [publicClient]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setConfirmIntent(null);
    setSubmittedIntent(null);
    setResult(null);
    setActionError(null);
    setSaltVersion((current) => current + 1);
  }, [tokenId]);

  const activeMatch = useMemo(
    () => matches.find((match) => (match.nfaA === tokenNumber || match.nfaB === tokenNumber) && match.phase < 4) ?? null,
    [matches, tokenNumber],
  );

  const recentOwnedMatch = useMemo(
    () => matches.find((match) => match.nfaA === tokenNumber || match.nfaB === tokenNumber) ?? null,
    [matches, tokenNumber],
  );

  const joinableMatches = useMemo(
    () => matches.filter((match) => match.phase === 0 && match.nfaA !== tokenNumber && match.nfaB === 0),
    [matches, tokenNumber],
  );

  useEffect(() => {
    if (joinableMatches.length === 0) {
      setSelectedJoinMatchId(null);
      return;
    }

    setSelectedJoinMatchId((current) => {
      if (current && joinableMatches.some((match) => match.matchId === current)) return current;
      return joinableMatches[0].matchId;
    });
  }, [joinableMatches]);

  const selectedJoinMatch = useMemo(
    () => joinableMatches.find((match) => match.matchId === selectedJoinMatchId) ?? null,
    [joinableMatches, selectedJoinMatchId],
  );

  const mySide = activeMatch
    ? activeMatch.nfaA === tokenNumber
      ? 'A'
      : activeMatch.nfaB === tokenNumber
        ? 'B'
        : null
    : null;

  const myRevealStored = useMemo(() => {
    if (!activeMatch) return null;
    return loadPKSalt(activeMatch.matchId);
  }, [activeMatch, saltVersion]);

  const myRevealed =
    activeMatch && mySide === 'A'
      ? activeMatch.revealedA
      : activeMatch && mySide === 'B'
        ? activeMatch.revealedB
        : false;

  const phaseAge = activeMatch ? Math.max(0, now - activeMatch.phaseTimestamp) : 0;
  const commitTimeoutRemaining =
    activeMatch && (activeMatch.phase === 0 || activeMatch.phase === 1)
      ? Math.max(0, timeouts.commit - phaseAge)
      : 0;
  const revealTimeoutRemaining =
    activeMatch && activeMatch.phase === 2
      ? Math.max(0, timeouts.reveal - phaseAge)
      : 0;

  const revealReady =
    Boolean(activeMatch) &&
    activeMatch!.phase === 2 &&
    !myRevealed &&
    Boolean(myRevealStored?.salt) &&
    (myRevealStored?.nfaId === undefined || myRevealStored.nfaId === tokenNumber);

  const settleReady =
    Boolean(activeMatch) &&
    (activeMatch!.phase === 3 || (activeMatch!.phase === 2 && revealTimeoutRemaining === 0));

  const cancelReady =
    Boolean(activeMatch) &&
    ((activeMatch!.phase === 0 || activeMatch!.phase === 1) ? commitTimeoutRemaining === 0 : activeMatch!.phase === 2 ? revealTimeoutRemaining === 0 : false);

  const createStake = parseStakeInput(createStakeInput);
  const createBlockedReason =
    !tokenId
      ? 'No active lobster selected.'
      : !ownerConnected
        ? 'Connect the owner wallet to create a PK match.'
        : activeMatch
          ? 'This lobster already has a live PK match.'
          : createStake === null
            ? 'Enter a valid stake.'
            : createStake <= 0n
              ? 'Stake must be greater than zero.'
              : reserve < createStake
                ? 'Reserve is below the requested stake.'
                : null;

  const joinBlockedReason =
    !tokenId
      ? 'No active lobster selected.'
      : !ownerConnected
        ? 'Connect the owner wallet to join a PK match.'
        : activeMatch
          ? 'This lobster already has a live PK match.'
          : !selectedJoinMatch
            ? 'No open PK match is ready to join.'
            : reserve < selectedJoinMatch.stake
              ? 'Reserve is below the target stake.'
              : null;

  const confirmStage = result
    ? 'settle'
    : receiptQuery.isLoading || isPending
      ? submittedIntent?.action === 'reveal'
        ? 'reveal'
        : submittedIntent?.action === 'settle' || submittedIntent?.action === 'cancel'
          ? 'settle'
          : 'commit'
      : confirmIntent
        ? confirmIntent.action === 'reveal'
          ? 'reveal'
          : confirmIntent.action === 'settle' || confirmIntent.action === 'cancel'
            ? 'settle'
            : 'commit'
        : settleReady
          ? 'settle'
          : revealReady
            ? 'reveal'
            : 'browse';

  useEffect(() => {
    let cancelled = false;

    async function estimateGas() {
      if (!publicClient || !address || !confirmIntent || tokenId === undefined) {
        setGasUnits(null);
        setGasCostWei(null);
        setGasEstimateError(null);
        return;
      }

      try {
        const args =
          confirmIntent.action === 'create'
            ? pkCreateArgs(tokenNumber, confirmIntent.stake, ZERO_HASH)
            : confirmIntent.action === 'join'
              ? pkJoinArgs(confirmIntent.matchId, tokenNumber, ZERO_HASH)
              : confirmIntent.action === 'reveal'
                ? pkRevealArgs(confirmIntent.matchId, confirmIntent.strategy, confirmIntent.salt)
                : confirmIntent.action === 'settle'
                  ? pkSettleArgs(confirmIntent.matchId)
                  : pkCancelArgs(confirmIntent.matchId, confirmIntent.phase);

        const [estimated, gasPrice] = await Promise.all([
          publicClient.estimateContractGas({
            ...(args as Record<string, unknown>),
            account: address as Address,
          } as any),
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
          setGasEstimateError(getPkErrorMessage(estimateFailure));
        }
      }
    }

    void estimateGas();
    return () => {
      cancelled = true;
    };
  }, [address, confirmIntent, publicClient, tokenId, tokenNumber]);

  useEffect(() => {
    if (!receiptQuery.data || !hash || !submittedIntent) return;

    let cancelled = false;
    const completedHash = hash;
    const completedIntent = submittedIntent;
    const completedReceipt = receiptQuery.data;

    async function handleReceipt() {
      if (completedIntent.action === 'create' || completedIntent.action === 'join') {
        const createdMatch = decodePkEvent(completedReceipt, 'MatchCreated');
        const matchId =
          completedIntent.action === 'create'
            ? Number(createdMatch?.matchId ?? 0)
            : completedIntent.matchId;

        if (matchId > 0) {
          savePKSalt(matchId, completedIntent.strategy, completedIntent.salt, tokenNumber);
          setSaltVersion((current) => current + 1);
        }

        let relayState: string | undefined;
        let relayMessage: string | undefined;
        let relayTxHash: `0x${string}` | undefined;

        if (ownerAddress && matchId > 0) {
          try {
            const relay = await syncPKAutoReveal({
              matchId,
              nfaId: tokenNumber,
              strategy: completedIntent.strategy,
              salt: completedIntent.salt,
              walletAddress: ownerAddress,
            });
            relayState = relay.state;
            relayMessage = relay.message;
            relayTxHash = relay.txHash;
          } catch (relayError) {
            relayState = 'unavailable';
            relayMessage = getPkErrorMessage(relayError);
          }
        }

        if (!cancelled) {
          setResult({
            action: completedIntent.action,
            matchId,
            txHash: completedHash,
            strategy: completedIntent.strategy,
            stake: completedIntent.stake,
            relayState,
            relayMessage,
            relayTxHash,
          });
        }
      }

      if (completedIntent.action === 'reveal') {
        localStorage.removeItem(`claw-pk-${completedIntent.matchId}`);
        setSaltVersion((current) => current + 1);
        const nextMatch = await loadMatch(completedIntent.matchId);
        if (!cancelled) {
          setResult({
            action: 'reveal',
            matchId: completedIntent.matchId,
            txHash: completedHash,
            phase: nextMatch?.phase,
            strategy: completedIntent.strategy,
          });
        }
      }

      if (completedIntent.action === 'settle') {
        const settled = decodePkEvent(completedReceipt, 'MatchSettled');
        let winnerNfaId: number | undefined;
        let loserNfaId: number | undefined;
        let reward: bigint | undefined;
        let burned: bigint | undefined;

        if (settled?.winner && settled?.loser && settled?.reward && settled?.burned) {
          winnerNfaId = Number(settled.winner);
          loserNfaId = Number(settled.loser);
          reward = BigInt(settled.reward as bigint);
          burned = BigInt(settled.burned as bigint);
          savePKResolutionCache({
            type: 'settled',
            matchId: completedIntent.matchId,
            winnerNfaId,
            loserNfaId,
            reward: reward.toString(),
            burned: burned.toString(),
            txHash: completedHash,
            ts: Date.now(),
          });
        } else {
          const resolution = await loadMatchResolution(completedIntent.matchId);
          if (resolution?.type === 'settled') {
            winnerNfaId = resolution.winnerNfaId;
            loserNfaId = resolution.loserNfaId;
            reward = resolution.reward;
            burned = resolution.burned;
            savePKResolutionCache({
              type: 'settled',
              matchId: completedIntent.matchId,
              winnerNfaId,
              loserNfaId,
              reward: reward.toString(),
              burned: burned.toString(),
              txHash: resolution.transactionHash,
              ts: Date.now(),
            });
          }
        }

        if (!cancelled) {
          setResult({
            action: 'settle',
            matchId: completedIntent.matchId,
            txHash: completedHash,
            winnerNfaId,
            loserNfaId,
            reward,
            burned,
            timeoutPath: completedIntent.timeoutPath,
          });
        }
      }

      if (completedIntent.action === 'cancel') {
        savePKResolutionCache({
          type: 'cancelled',
          matchId: completedIntent.matchId,
          txHash: completedHash,
          ts: Date.now(),
        });
        if (!cancelled) {
          setResult({
            action: 'cancel',
            matchId: completedIntent.matchId,
            txHash: completedHash,
          });
        }
      }

      if (!cancelled) {
        setConfirmIntent(null);
        setSubmittedIntent(null);
        setActionError(null);
        await refreshMatches();
      }
    }

    void handleReceipt();
    return () => {
      cancelled = true;
    };
  }, [hash, ownerAddress, receiptQuery.data, refreshMatches, submittedIntent, tokenNumber]);

  useEffect(() => {
    if (!error) return;
    setActionError(getPkErrorMessage(error));
    if (!hash) {
      setSubmittedIntent(null);
    }
  }, [error, hash]);

  const recentItems = useMemo(() => {
    return matches.slice(0, 5).map((match) => {
      const involvesCompanion = match.nfaA === tokenNumber || match.nfaB === tokenNumber;
      const opponentNfaId =
        match.nfaA === tokenNumber ? match.nfaB : match.nfaB === tokenNumber ? match.nfaA : match.nfaA;

      return {
        match,
        involvesCompanion,
        opponentNfaId,
      };
    });
  }, [matches, tokenNumber]);

  const activeMatchHeadline = !activeMatch
    ? 'No live PK match is attached to this lobster.'
    : `Match #${activeMatch.matchId} ${phaseName(activeMatch.phase)}`;

  const activeMatchDetail = !activeMatch
    ? 'Use the open field below to join an existing match, or open a fresh match with commit protection.'
    : mySide === 'A'
      ? `You opened this match against NFA #${activeMatch.nfaB || 0}.`
      : `You joined against NFA #${activeMatch.nfaA}.`;

  async function submitIntent(intent: ConfirmIntent) {
    setActionError(null);
    setResult(null);

    try {
      if (intent.action === 'create') {
        const { commitHash, salt } = generateCommit(intent.strategy, address as Address);
        const nextIntent: SubmittedIntent = { ...intent, commitHash, salt };
        setSubmittedIntent(nextIntent);
        await writeContractAsync(pkCreateArgs(tokenNumber, intent.stake, commitHash));
        return;
      }

      if (intent.action === 'join') {
        const { commitHash, salt } = generateCommit(intent.strategy, address as Address);
        const nextIntent: SubmittedIntent = { ...intent, commitHash, salt };
        setSubmittedIntent(nextIntent);
        await writeContractAsync(pkJoinArgs(intent.matchId, tokenNumber, commitHash));
        return;
      }

      if (intent.action === 'reveal') {
        setSubmittedIntent(intent);
        await writeContractAsync(pkRevealArgs(intent.matchId, intent.strategy, intent.salt));
        return;
      }

      if (intent.action === 'settle') {
        setSubmittedIntent(intent);
        await writeContractAsync(pkSettleArgs(intent.matchId));
        return;
      }

      setSubmittedIntent(intent);
      await writeContractAsync(pkCancelArgs(intent.matchId, intent.phase));
    } catch (submitError) {
      setSubmittedIntent(null);
      setActionError(getPkErrorMessage(submitError));
    }
  }

  const confirmBlockedReason =
    !ownerConnected
      ? 'Connect the owner wallet before signing a PK action.'
      : gasEstimateError
        ? gasEstimateError
        : null;

  return (
    <>
      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">PK arena</span>
            <h3>PK now has a full owner-path transaction surface.</h3>
            <p className="cw-muted">
              Browse open matches, lock strategy with commit, reveal from saved local salt, and settle or cancel stale matches without leaving Arena.
            </p>
          </div>
          <span className={`cw-chip ${activeMatch ? 'cw-chip--warm' : joinableMatches.length > 0 ? 'cw-chip--growth' : 'cw-chip--cool'}`}>
            <Swords size={14} />
            {activeMatch ? phaseName(activeMatch.phase) : `${joinableMatches.length} open`}
          </span>
        </div>

        <div className="cw-flow-track">
          {[
            { key: 'browse', label: 'Browse' },
            { key: 'commit', label: 'Commit' },
            { key: 'reveal', label: 'Reveal' },
            { key: 'settle', label: 'Settle' },
          ].map((step) => {
            const active =
              confirmStage === step.key ||
              (confirmStage === 'commit' && step.key === 'browse') ||
              (confirmStage === 'reveal' && (step.key === 'browse' || step.key === 'commit')) ||
              (confirmStage === 'settle' && step.key !== 'browse');

            return (
              <div key={step.key} className={`cw-flow-node ${active ? 'cw-flow-node--active' : ''}`}>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">Live match</span>
            <h3>{activeMatchHeadline}</h3>
            <p className="cw-muted">{activeMatchDetail}</p>
          </div>
          <span className={`cw-chip ${activeMatch ? 'cw-chip--warm' : 'cw-chip--cool'}`}>
            <Shield size={14} />
            {activeMatch ? `#${activeMatch.matchId}` : 'idle'}
          </span>
        </div>

        <div className="cw-state-grid">
          <div className="cw-state-card">
            <span className="cw-label">Reserve</span>
            <strong>{reserveText}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">Opponent</span>
            <strong>{activeMatch ? `#${mySide === 'A' ? activeMatch.nfaB || 0 : activeMatch.nfaA}` : '--'}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">Stake</span>
            <strong>{activeMatch ? formatCLW(activeMatch.stake) : '--'}</strong>
          </div>
        </div>

        <div className="cw-detail-list">
          <div className="cw-detail-row">
            <span>Role</span>
            <strong>{activeMatch ? (mySide === 'A' ? 'Match creator' : 'Challenger') : 'None'}</strong>
          </div>
          <div className="cw-detail-row">
            <span>Phase timer</span>
            <strong>
              {activeMatch && (activeMatch.phase === 0 || activeMatch.phase === 1)
                ? commitTimeoutRemaining === 0
                  ? 'Commit timeout reached'
                  : formatRemaining(commitTimeoutRemaining)
                : activeMatch && activeMatch.phase === 2
                  ? revealTimeoutRemaining === 0
                    ? 'Reveal timeout reached'
                    : formatRemaining(revealTimeoutRemaining)
                  : activeMatch
                    ? 'Ready now'
                    : '--'}
            </strong>
          </div>
          <div className="cw-detail-row">
            <span>Reveal key</span>
            <strong>
              {myRevealStored?.salt
                ? `${getStrategyLabel(myRevealStored.strategy as StrategyValue)} saved locally`
                : activeMatch && activeMatch.phase === 2
                  ? 'Missing from this browser'
                  : 'Not needed'}
            </strong>
          </div>
          <div className="cw-detail-row">
            <span>Owner wallet</span>
            <strong>{ownerAddress ? truncateAddress(ownerAddress) : 'Unknown'}</strong>
          </div>
        </div>

        <div className="cw-list">
          {activeMatch && revealReady ? (
            <div className="cw-list-item cw-list-item--warm">
              <Sparkles size={16} />
              <span>Reveal is ready from this browser because the saved local strategy and salt still match this lobster.</span>
            </div>
          ) : null}
          {activeMatch && activeMatch.phase === 2 && !revealReady ? (
            <div className="cw-list-item cw-list-item--cool">
              <TimerReset size={16} />
              <span>Reveal is not available here yet. Either the reveal already landed or the local commit bundle is missing.</span>
            </div>
          ) : null}
          {activeMatch && settleReady ? (
            <div className="cw-list-item cw-list-item--warm">
              <CheckCircle2 size={16} />
              <span>
                {activeMatch.phase === 3
                  ? 'Both strategies are revealed. This match can settle now.'
                  : 'Reveal timeout has passed. This match can be settled on the timeout path.'}
              </span>
            </div>
          ) : null}
          {!activeMatch ? (
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>No live match is holding this lobster. You can open or join a match below.</span>
            </div>
          ) : null}
        </div>

        <div className="cw-button-row">
          {revealReady ? (
            <button
              type="button"
              className="cw-button cw-button--primary"
              onClick={() =>
                setConfirmIntent({
                  action: 'reveal',
                  matchId: activeMatch!.matchId,
                  strategy: myRevealStored!.strategy as StrategyValue,
                  salt: myRevealStored!.salt as `0x${string}`,
                })
              }
            >
              <Sparkles size={16} />
              Review reveal
            </button>
          ) : null}
          {settleReady ? (
            <button
              type="button"
              className="cw-button cw-button--secondary"
              onClick={() =>
                setConfirmIntent({
                  action: 'settle',
                  matchId: activeMatch!.matchId,
                  timeoutPath: activeMatch!.phase === 2,
                })
              }
            >
              <CheckCircle2 size={16} />
              Review settle
            </button>
          ) : null}
          {cancelReady ? (
            <button
              type="button"
              className="cw-button cw-button--ghost"
              onClick={() =>
                setConfirmIntent({
                  action: 'cancel',
                  matchId: activeMatch!.matchId,
                  phase: activeMatch!.phase,
                })
              }
            >
              <TimerReset size={16} />
              Review cancel
            </button>
          ) : null}
        </div>
      </section>

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">Open field</span>
            <h3>Join an existing PK match</h3>
            <p className="cw-muted">
              Join only from the owner wallet. Strategy stays hidden until reveal, and the local salt is saved here for later settlement.
            </p>
          </div>
          <span className={`cw-chip ${joinableMatches.length > 0 ? 'cw-chip--growth' : 'cw-chip--cool'}`}>
            <Swords size={14} />
            {joinableMatches.length} open
          </span>
        </div>

        {joinableMatches.length > 0 ? (
          <div className="cw-card-stack">
            {joinableMatches.slice(0, 4).map((match) => (
              <button
                key={match.matchId}
                type="button"
                className={`cw-card cw-card--button cw-card--safe ${selectedJoinMatch?.matchId === match.matchId ? 'cw-card--selected' : ''}`}
                onClick={() => setSelectedJoinMatchId(match.matchId)}
              >
                <div className="cw-card-icon">
                  <Swords size={18} />
                </div>
                <div className="cw-card-copy">
                  <p className="cw-label">Match #{match.matchId}</p>
                  <h3>vs NFA #{match.nfaA}</h3>
                  <p className="cw-muted">Stake {formatCLW(match.stake)} / open since {formatRemaining(now - match.phaseTimestamp)}</p>
                </div>
                <div className="cw-score">
                  <strong>{formatCLW(match.stake)}</strong>
                  <span>stake</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>No open PK match is readable right now. Open a new one below if you want the first position.</span>
            </div>
          </div>
        )}

        <div className="cw-field-grid">
          {STRATEGIES.map((option) => (
            <button
              key={`join-${option.value}`}
              type="button"
              className={`cw-card cw-card--button ${option.tone} ${joinStrategy === option.value ? 'cw-card--selected' : ''}`}
              onClick={() => setJoinStrategy(option.value)}
            >
              <div className="cw-card-copy">
                <p className="cw-label">{option.label}</p>
                <p className="cw-muted">{option.detail}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="cw-detail-list">
          <div className="cw-detail-row">
            <span>Selected match</span>
            <strong>{selectedJoinMatch ? `#${selectedJoinMatch.matchId}` : 'None'}</strong>
          </div>
          <div className="cw-detail-row">
            <span>Stake to join</span>
            <strong>{selectedJoinMatch ? formatCLW(selectedJoinMatch.stake) : '--'}</strong>
          </div>
          <div className="cw-detail-row">
            <span>Strategy</span>
            <strong>{getStrategyLabel(joinStrategy)}</strong>
          </div>
        </div>

        {joinBlockedReason ? (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--cool">
              <TimerReset size={16} />
              <span>{joinBlockedReason}</span>
            </div>
          </div>
        ) : null}

        <div className="cw-button-row">
          <button
            type="button"
            className="cw-button cw-button--primary"
            disabled={Boolean(joinBlockedReason)}
            onClick={() =>
              selectedJoinMatch &&
              setConfirmIntent({
                action: 'join',
                matchId: selectedJoinMatch.matchId,
                strategy: joinStrategy,
                stake: selectedJoinMatch.stake,
                opponentNfaId: selectedJoinMatch.nfaA,
              })
            }
          >
            <CheckCircle2 size={16} />
            Review join
          </button>
        </div>
      </section>

      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">Open new match</span>
            <h3>Create a fresh PK match with commit protection</h3>
            <p className="cw-muted">
              Use this when the field does not already offer a good open match. The app saves the reveal salt locally and forwards it to auto-reveal if the relay is available.
            </p>
          </div>
          <span className="cw-chip cw-chip--warm">
            <Sparkles size={14} />
            {reserveText} reserve
          </span>
        </div>

        <div className="cw-field-grid">
          <label className="cw-field">
            <span className="cw-label">Stake</span>
            <input
              className="cw-input"
              inputMode="decimal"
              value={createStakeInput}
              onChange={(event) => setCreateStakeInput(event.target.value)}
              placeholder="24"
            />
            <p className="cw-muted">Recommended from current level and arena posture.</p>
          </label>
          {STRATEGIES.map((option) => (
            <button
              key={`create-${option.value}`}
              type="button"
              className={`cw-card cw-card--button ${option.tone} ${createStrategy === option.value ? 'cw-card--selected' : ''}`}
              onClick={() => setCreateStrategy(option.value)}
            >
              <div className="cw-card-copy">
                <p className="cw-label">{option.label}</p>
                <p className="cw-muted">{option.detail}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="cw-detail-list">
          <div className="cw-detail-row">
            <span>Selected stake</span>
            <strong>{createStake !== null ? formatCLW(createStake) : '--'}</strong>
          </div>
          <div className="cw-detail-row">
            <span>Strategy</span>
            <strong>{getStrategyLabel(createStrategy)}</strong>
          </div>
          <div className="cw-detail-row">
            <span>Reserve after open</span>
            <strong>
              {createStake !== null && reserve >= createStake ? formatCLW(reserve - createStake) : 'Insufficient'}
            </strong>
          </div>
        </div>

        {createBlockedReason ? (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--cool">
              <TimerReset size={16} />
              <span>{createBlockedReason}</span>
            </div>
          </div>
        ) : null}

        <div className="cw-button-row">
          <button
            type="button"
            className="cw-button cw-button--primary"
            disabled={Boolean(createBlockedReason)}
            onClick={() =>
              createStake &&
              setConfirmIntent({
                action: 'create',
                strategy: createStrategy,
                stake: createStake,
              })
            }
          >
            <CheckCircle2 size={16} />
            Review create
          </button>
        </div>
      </section>

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">Recent tape</span>
            <h3>Recent PK matches around this lobster</h3>
          </div>
          <button type="button" className="cw-button cw-button--ghost" onClick={() => void refreshMatches()} disabled={isLoading}>
            <TimerReset size={16} />
            {isLoading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        <div className="cw-list">
          {recentItems.length > 0 ? (
            recentItems.map(({ match, involvesCompanion, opponentNfaId }) => (
              <div
                key={match.matchId}
                className={`cw-list-item ${involvesCompanion ? 'cw-list-item--warm' : 'cw-list-item--cool'}`}
              >
                <Shield size={16} />
                <span>
                  Match #{match.matchId} / {phaseName(match.phase)} / {match.nfaB > 0 ? `vs #${opponentNfaId}` : 'waiting for challenger'} / stake {formatCLW(match.stake)}
                  {match.resolution?.type === 'settled'
                    ? ` / winner #${match.resolution.winnerNfaId} / reward ${formatCLW(parseCachedAmount(match.resolution.reward))}`
                    : match.resolution?.type === 'cancelled'
                      ? ' / cancelled'
                      : ''}
                </span>
              </div>
            ))
          ) : (
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>No recent PK matches were readable from the contract.</span>
            </div>
          )}
          {recentOwnedMatch && recentOwnedMatch.phase >= 4 ? (
            <div className="cw-list-item cw-list-item--warm">
              <CheckCircle2 size={16} />
              <span>
                Latest owned result: match #{recentOwnedMatch.matchId} / {phaseName(recentOwnedMatch.phase)}
                {recentOwnedMatch.resolution?.type === 'settled'
                  ? ` / winner #${recentOwnedMatch.resolution.winnerNfaId}`
                  : recentOwnedMatch.resolution?.type === 'cancelled'
                    ? ' / cancelled'
                    : ''}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      {confirmIntent ? (
        <section className="cw-sheet">
          <div className="cw-sheet-head">
            <div>
              <span className="cw-label">Confirm PK action</span>
              <h3>
                {confirmIntent.action === 'create'
                  ? 'Create match'
                  : confirmIntent.action === 'join'
                    ? `Join match #${confirmIntent.matchId}`
                    : confirmIntent.action === 'reveal'
                      ? `Reveal strategy for #${confirmIntent.matchId}`
                      : confirmIntent.action === 'settle'
                        ? `Settle match #${confirmIntent.matchId}`
                        : `Cancel match #${confirmIntent.matchId}`}
              </h3>
              <p className="cw-muted">
                {confirmIntent.action === 'create' || confirmIntent.action === 'join'
                  ? 'Commit hash is generated locally. The clear strategy only appears during reveal.'
                  : confirmIntent.action === 'reveal'
                    ? 'This uses the locally saved strategy and salt bundle from the earlier commit.'
                    : confirmIntent.action === 'settle'
                      ? 'Settlement finalizes the current PK state and pushes the outcome into recent tape.'
                      : 'Cancellation is only safe on timeout paths. Use it to clean up stalled matches, not active ones.'}
              </p>
            </div>
            <span className={`cw-chip ${confirmBlockedReason ? 'cw-chip--alert' : 'cw-chip--warm'}`}>
              {confirmBlockedReason ? 'Blocked' : 'Ready'}
            </span>
          </div>

          <div className="cw-state-grid">
            <div className="cw-state-card">
              <span className="cw-label">Action</span>
              <strong>{confirmIntent.action}</strong>
            </div>
            <div className="cw-state-card">
              <span className="cw-label">Strategy</span>
              <strong>
                {'strategy' in confirmIntent ? getStrategyLabel(confirmIntent.strategy as StrategyValue) : 'n/a'}
              </strong>
            </div>
            <div className="cw-state-card">
              <span className="cw-label">Stake</span>
              <strong>{'stake' in confirmIntent ? formatCLW(confirmIntent.stake) : activeMatch ? formatCLW(activeMatch.stake) : '--'}</strong>
            </div>
          </div>

          <div className="cw-detail-list">
            <div className="cw-detail-row">
              <span>Companion</span>
              <strong>{companionName} #{tokenNumber}</strong>
            </div>
            <div className="cw-detail-row">
              <span>Owner wallet</span>
              <strong>{address ? truncateAddress(address) : 'Not connected'}</strong>
            </div>
            <div className="cw-detail-row">
              <span>Gas estimate</span>
              <strong>{gasCostWei !== null ? `${formatBNB(gasCostWei, 6)} BNB` : '--'}</strong>
            </div>
            <div className="cw-detail-row">
              <span>Local commit storage</span>
              <strong>
                {confirmIntent.action === 'create' || confirmIntent.action === 'join'
                  ? 'Will save after confirm'
                  : confirmIntent.action === 'reveal'
                    ? 'Already saved'
                    : 'Not used'}
              </strong>
            </div>
          </div>

          {confirmBlockedReason ? (
            <div className="cw-list">
              <div className="cw-list-item cw-list-item--cool">
                <Shield size={16} />
                <span>{confirmBlockedReason}</span>
              </div>
            </div>
          ) : null}

          <div className="cw-button-row">
            <button
              type="button"
              className="cw-button cw-button--primary"
              disabled={Boolean(confirmBlockedReason) || isPending || receiptQuery.isLoading}
              onClick={() => void submitIntent(confirmIntent)}
            >
              <Sparkles size={16} />
              {isPending ? 'Sign action' : receiptQuery.isLoading ? 'Confirming' : 'Execute PK action'}
            </button>
            <button
              type="button"
              className="cw-button cw-button--ghost"
              disabled={isPending || receiptQuery.isLoading}
              onClick={() => setConfirmIntent(null)}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {result ? (
        <section className="cw-result-panel">
          <div className="cw-result-head">
            <div className="cw-result-icon">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <span className="cw-label">PK update</span>
              <h3>
                {result.action === 'create'
                  ? `Match #${result.matchId} opened`
                  : result.action === 'join'
                    ? `Match #${result.matchId} joined`
                    : result.action === 'reveal'
                      ? `Reveal submitted for #${result.matchId}`
                      : result.action === 'settle'
                        ? `Match #${result.matchId} settled`
                        : `Match #${result.matchId} cancelled`}
              </h3>
            </div>
          </div>

          <div className="cw-result-grid">
            <div className="cw-result-stat">
              <span className="cw-label">Action</span>
              <strong>{result.action}</strong>
            </div>
            <div className="cw-result-stat">
              <span className="cw-label">Match</span>
              <strong>#{result.matchId}</strong>
            </div>
            <div className="cw-result-stat">
              <span className="cw-label">Stake / reward</span>
              <strong>
                {'stake' in result
                  ? formatCLW(result.stake)
                  : result.action === 'settle' && result.reward !== undefined
                    ? formatCLW(result.reward)
                    : '--'}
              </strong>
            </div>
          </div>

          <div className="cw-list">
            {'strategy' in result ? (
              <div className="cw-list-item cw-list-item--warm">
                <Sparkles size={16} />
                <span>Strategy locked as {getStrategyLabel(result.strategy as StrategyValue)}.</span>
              </div>
            ) : null}
            {result.action === 'create' || result.action === 'join' ? (
              <div className={`cw-list-item ${result.relayState === 'relayed' ? 'cw-list-item--warm' : 'cw-list-item--cool'}`}>
                <TimerReset size={16} />
                <span>
                  Auto-reveal sync: {result.relayState ?? 'not attempted'}
                  {result.relayMessage ? ` / ${result.relayMessage}` : ''}
                </span>
              </div>
            ) : null}
            {result.action === 'settle' ? (
              <div className="cw-list-item cw-list-item--warm">
                <Shield size={16} />
                <span>
                  {result.timeoutPath
                    ? 'Timeout settlement path executed.'
                    : 'Normal revealed settlement path executed.'}
                  {result.winnerNfaId ? ` Winner #${result.winnerNfaId}.` : ''}
                  {result.reward !== undefined ? ` Reward ${formatCLW(result.reward)}.` : ''}
                  {result.burned !== undefined ? ` Burned ${formatCLW(result.burned)}.` : ''}
                </span>
              </div>
            ) : null}
            {result.action === 'cancel' ? (
              <div className="cw-list-item cw-list-item--cool">
                <TimerReset size={16} />
                <span>Timeout cancellation confirmed. The stale match is now removed from the live loop.</span>
              </div>
            ) : null}
            {result.action === 'reveal' ? (
              <div className="cw-list-item cw-list-item--warm">
                <CheckCircle2 size={16} />
                <span>
                  Reveal confirmed. Match phase now reads {result.phase !== undefined ? phaseName(result.phase) : 'updated'} after refresh.
                </span>
              </div>
            ) : null}
          </div>

          <div className="cw-button-row">
            <a href={getBscScanTxUrl(result.txHash)} target="_blank" rel="noopener noreferrer" className="cw-button cw-button--secondary">
              <ArrowUpRight size={16} />
              View transaction
            </a>
            {'relayTxHash' in result && result.relayTxHash ? (
              <a
                href={getBscScanTxUrl(result.relayTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="cw-button cw-button--ghost"
              >
                <ArrowUpRight size={16} />
                View relay
              </a>
            ) : null}
            <button type="button" className="cw-button cw-button--ghost" onClick={() => setResult(null)}>
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {gasUnits !== null ? (
        <p className="cw-muted">
          Estimated gas: {gasUnits.toString()} units
          {gasCostWei !== null ? ` / approx ${formatBNB(gasCostWei, 6)} BNB at current gas price.` : '.'}
        </p>
      ) : null}
      {actionError ? <p className="cw-muted">PK action failed: {actionError}</p> : null}
      {loadError ? <p className="cw-muted">PK read failed: {loadError}</p> : null}
    </>
  );
}
