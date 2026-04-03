'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect, useWriteContract } from 'wagmi';
import { decodeEventLog, formatEther, parseEther, type Address, type TransactionReceipt } from 'viem';

import { GameCommandShell } from '@/components/game/GameCommandShell';
import { eventBus } from '@/game/EventBus';
import {
  loadMatch,
  loadMarketListings,
  loadNFAState,
  loadNfaSummaries,
  loadPlayerNFAs,
  loadRecentMatches,
  publicClient,
  type NFASummary,
} from '@/game/chain/wallet';
import {
  generateCommit,
  loadPKSalt,
  marketAcceptSwapArgs,
  marketAuctionArgs,
  marketBidArgs,
  marketBuyArgs,
  marketCancelArgs,
  marketListArgs,
  marketSwapArgs,
  marketSettleAuctionArgs,
  nfaApproveArgs,
  pkCancelArgs,
  pkCreateArgs,
  pkJoinArgs,
  pkRevealArgs,
  pkSettleArgs,
  processUpkeepArgs,
  savePKSalt,
  savePKResolutionCache,
  taskSubmitArgs,
} from '@/game/chain/contracts';
import { addresses } from '@/contracts/addresses';
import { MarketSkillABI } from '@/contracts/abis/MarketSkill';
import { PKSkillABI } from '@/contracts/abis/PKSkill';
import { TaskSkillABI } from '@/contracts/abis/TaskSkill';
import { useI18n } from '@/lib/i18n';
import { getLobsterName } from '@/lib/mockData';
import { getRarityName } from '@/lib/rarity';
import { getShelterName } from '@/lib/shelter';

type GameStatus = 'loading' | 'ready' | 'connected' | 'booting' | 'no-nfa' | 'select-nfa' | 'loading-nfa' | 'playing' | 'error';
type PendingTx = { hash: `0x${string}`; label: string } | null;

const PK_PHASE_NAMES = ['OPEN', 'JOINED', 'COMMITTED', 'REVEALED', 'SETTLED', 'CANCELLED'];

function txLabel(label: string, zh: boolean) {
  const labels: Record<string, string> = {
    'PROCESSING UPKEEP': zh ? '结算日常维护' : 'Processing upkeep',
    'SUBMITTING TASK': zh ? '提交任务' : 'Submitting task',
    'CREATING PK MATCH': zh ? '创建 PK 对局' : 'Creating PK match',
    'JOINING PK MATCH': zh ? '加入 PK 对局' : 'Joining PK match',
    'REVEALING STRATEGY': zh ? '公开策略' : 'Revealing strategy',
    'SETTLING PK MATCH': zh ? '结算 PK 对局' : 'Settling PK match',
    'CANCELLING PK MATCH': zh ? '取消 PK 对局' : 'Cancelling PK match',
    'BUYING NFA': zh ? '购买 NFA' : 'Buying NFA',
    'PLACING BID': zh ? '提交出价' : 'Placing bid',
    'SETTLING AUCTION': zh ? '结算拍卖' : 'Settling auction',
    'CANCELLING LISTING': zh ? '取消挂单' : 'Cancelling listing',
    'APPROVING SWAP NFA': zh ? '授权互换 NFA' : 'Approving swap NFA',
    'ACCEPTING SWAP': zh ? '接受互换' : 'Accepting swap',
    'APPROVING NFA': zh ? '授权 NFA' : 'Approving NFA',
    'LISTING SWAP': zh ? '创建互换挂单' : 'Creating swap listing',
    'CREATING AUCTION': zh ? '创建拍卖挂单' : 'Creating auction',
    'LISTING NFA': zh ? '创建固定价挂单' : 'Listing NFA',
  };
  return labels[label] ?? label;
}

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Transaction failed';

  if (error.message.includes('User rejected')) return 'User rejected transaction';
  if (error.message.includes('Cooldown active')) return 'Task cooldown is still active';
  if (error.message.includes('Not NFA owner')) return 'Current wallet does not own this NFA';
  if (error.message.includes('Insufficient CLW')) return 'Not enough Claworld balance';
  if (error.message.includes('Invalid reveal')) return 'Saved strategy does not match on-chain commit';

  return error.message;
}

function getReceiptEventArgs(
  abi: any,
  receipt: TransactionReceipt,
  contractAddress: Address,
  eventName: string,
) {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics }) as {
        eventName: string;
        args: Record<string, unknown>;
      };
      if (decoded.eventName === eventName) {
        return decoded.args as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * /game — Claw World 2D RPG 游戏页
 * 全屏 Phaser 画布 + React 覆盖层 + 链上事件桥接
 */
export default function GamePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<unknown>(null);
  const activeNfaIdRef = useRef<number | null>(null);
  const bootReadyRef = useRef(false);
  const bootReadyPromiseRef = useRef<Promise<void> | null>(null);

  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { writeContractAsync } = useWriteContract();
  const { lang, setLang } = useI18n();

  const [status, setStatus] = useState<GameStatus>('loading');
  const [nfaList, setNfaList] = useState<number[]>([]);
  const [nfaSummaries, setNfaSummaries] = useState<Record<number, NFASummary>>({});
  const [activeNfaId, setActiveNfaId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pendingTx, setPendingTx] = useState<PendingTx>(null);
  const [showOpenClaw, setShowOpenClaw] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [isPortraitViewport, setIsPortraitViewport] = useState(false);
  const [gameViewportStyle, setGameViewportStyle] = useState<{ width: string; height: string }>({ width: '100%', height: '100%' });

  const walletOptions = useMemo(
    () => connectors.filter((connector) => connector.type === 'injected' || connector.name === 'WalletConnect' || connector.name === 'Coinbase Wallet'),
    [connectors],
  );

  const activeSummary = activeNfaId ? nfaSummaries[activeNfaId] : undefined;

  const connectWallet = useCallback((query?: string) => {
    if (walletOptions.length === 0) {
      return false;
    }

    const normalized = query?.toLowerCase().replace(/\s+/g, '');
    const connector = normalized
      ? walletOptions.find((item) => {
          const id = item.id.toLowerCase().replace(/\s+/g, '');
          const name = item.name.toLowerCase().replace(/\s+/g, '');
          return id.includes(normalized) || name.includes(normalized);
        })
      : walletOptions[0];

    if (!connector) {
      return false;
    }

    setSelectedConnectorId(connector.id);
    connect({ connector });
    return true;
  }, [connect, walletOptions]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    const syncViewport = () => {
      const compact = window.innerWidth < 820 || window.innerHeight < 700;
      const portrait = window.innerWidth < window.innerHeight;
      const frame = containerRef.current?.parentElement;
      const frameRect = frame?.getBoundingClientRect();
      const width = frameRect?.width ?? 0;
      const height = frameRect?.height ?? 0;

      setIsCompactViewport(compact);
      setIsPortraitViewport(portrait);

      if (width <= 0 || height <= 0) return;

      const targetAspect = portrait ? 9 / 16 : width / height;
      const fittedHeight = width / targetAspect;
      if (fittedHeight <= height) {
        setGameViewportStyle({ width: '100%', height: `${fittedHeight}px` });
      } else {
        setGameViewportStyle({ width: `${height * targetAspect}px`, height: '100%' });
      }
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, [mounted]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !mounted) return;

    container.style.width = gameViewportStyle.width;
    container.style.height = gameViewportStyle.height;
  }, [gameViewportStyle, mounted]);

  useEffect(() => {
    if (!mounted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') { e.preventDefault(); setShowSidePanel(p => !p); }
      if (e.key.toLowerCase() === 'h') { e.preventDefault(); setShowHelpPanel(p => !p); }
      if (e.key === 'Escape') {
        setShowSidePanel(false);
        setShowHelpPanel(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted]);

  const emitNfaState = useCallback((nfaId: number, state: Awaited<ReturnType<typeof loadNFAState>>) => {
    setNfaSummaries((current) => ({
      ...current,
      [nfaId]: {
        tokenId: nfaId,
        rarity: state.rarity,
        shelter: state.shelter,
        level: state.level,
        clwBalance: state.clwBalance,
        active: state.active,
        dailyCost: state.dailyCost,
        courage: state.courage,
        wisdom: state.wisdom,
        social: state.social,
        create: state.create,
        grit: state.grit,
      },
    }));

    eventBus.emit('nfa:stats', {
      clw: state.clwBalance.toFixed(0),
      level: state.level,
      active: state.active,
      dailyCost: state.dailyCost.toFixed(2),
    });

    eventBus.emit('nfa:fullStats', {
      level: state.level,
      clw: state.clwBalance.toFixed(0),
      bnb: '0',
      courage: state.courage,
      wisdom: state.wisdom,
      social: state.social,
      create: state.create,
      grit: state.grit,
      hp: state.vit * 10,
      active: state.active,
      dailyCost: state.dailyCost,
      shelter: state.shelter,
    });

    eventBus.emit('nfa:active', {
      nfaId,
      shelter: state.shelter,
      personality: {
        courage: state.courage,
        wisdom: state.wisdom,
        social: state.social,
        create: state.create,
        grit: state.grit,
      },
    });
  }, []);

  const refreshOwnedNfas = useCallback(async () => {
    if (!isConnected || !address) return [];
    const ids = await loadPlayerNFAs(address as Address);
    setNfaList(ids);

    const summaries = await loadNfaSummaries(ids);
    setNfaSummaries(summaries);
    eventBus.emit('wallet:nfas', { ids, summaries });

    return ids;
  }, [address, isConnected]);

  const refreshActiveNfaState = useCallback(async (nfaId?: number) => {
    const targetId = nfaId ?? activeNfaIdRef.current;
    if (!targetId) return null;

    const state = await loadNFAState(targetId);
    emitNfaState(targetId, state);
    return state;
  }, [emitNfaState]);

  const waitForReceipt = useCallback(async (hash: `0x${string}`, label: string) => {
    setPendingTx({ hash, label });
    try {
      return await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    } finally {
      setPendingTx((current) => (current?.hash === hash ? null : current));
    }
  }, []);

  const syncAfterOwnershipChange = useCallback(async () => {
    const ids = await refreshOwnedNfas();
    const activeNfaId = activeNfaIdRef.current;

    if (activeNfaId && !ids.includes(activeNfaId)) {
      activeNfaIdRef.current = null;
      setActiveNfaId(null);
      setStatus(ids.length === 0 ? 'no-nfa' : 'select-nfa');
    }

    return ids;
  }, [refreshOwnedNfas]);

  const ensureGame = useCallback(async () => {
    if (gameRef.current) {
      if (bootReadyPromiseRef.current) {
        await bootReadyPromiseRef.current;
      }
      return gameRef.current;
    }

    const waitForPaint = () => new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

    let readyContainer: HTMLDivElement | null = null;
    let readyRect: DOMRect | null = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      await waitForPaint();
      readyContainer = containerRef.current;
      if (!readyContainer) continue;

      const parentRect = readyContainer.parentElement?.getBoundingClientRect();
      if (!parentRect || parentRect.width === 0 || parentRect.height === 0) {
        continue;
      }

      readyContainer.style.width = gameViewportStyle.width;
      readyContainer.style.height = gameViewportStyle.height;

      readyRect = readyContainer.getBoundingClientRect();
      if (readyRect.width > 0 && readyRect.height > 0) {
        break;
      }
    }

    if (!readyContainer) {
      throw new Error('Game container missing');
    }

    if (!readyRect || readyRect.width === 0 || readyRect.height === 0) {
      throw new Error('Game container has zero size');
    }

    bootReadyRef.current = false;
    bootReadyPromiseRef.current = new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        unsubscribe();
        reject(new Error('BootScene ready timeout'));
      }, 12000);

      const unsubscribe = eventBus.on('game:ready', () => {
        bootReadyRef.current = true;
        window.clearTimeout(timeoutId);
        unsubscribe();
        resolve();
      });
    });

    const { createGame } = await import('@/game/main');
    gameRef.current = createGame(readyContainer);
    setGameReady(true);

    await bootReadyPromiseRef.current;
    return gameRef.current;
  }, []);

  const selectAndEnter = useCallback(async (nfaId: number) => {
    if (activeNfaIdRef.current === nfaId && status === 'playing') {
      setShowSidePanel(false);
      return;
    }

    setStatus('loading-nfa');
    setShowSidePanel(false);
    activeNfaIdRef.current = nfaId;
    setActiveNfaId(nfaId);

    try {
      await ensureGame();
      const state = await loadNFAState(nfaId);
      emitNfaState(nfaId, state);
      eventBus.emit('nfa:loaded', { nfaId, shelter: state.shelter });
      eventBus.emit('game:scene', { scene: 'shelter', nfaId, shelter: state.shelter });
      eventBus.emit('game:switchNfa', {
        nfaId,
        shelter: state.shelter,
        lang,
        personality: {
          courage: state.courage,
          wisdom: state.wisdom,
          social: state.social,
          create: state.create,
          grit: state.grit,
        },
      });
      setStatus('playing');
    } catch (error) {
      console.error('Failed to load NFA state:', error);
      setStatus('error');
    }
  }, [emitNfaState, ensureGame, lang]);

  useEffect(() => {
    return () => {
      if (gameRef.current) {
        (gameRef.current as { destroy: (removeCanvas?: boolean) => void }).destroy(true);
        gameRef.current = null;
        bootReadyRef.current = false;
        bootReadyPromiseRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void ensureGame().catch((error) => {
      console.error('Failed to initialize game canvas:', error);
    });
  }, [ensureGame, mounted]);

  useEffect(() => {
    if (!mounted) return;

    if (!isConnected) {
      activeNfaIdRef.current = null;
      setActiveNfaId(null);
      setNfaList([]);
      setNfaSummaries({});
      eventBus.emit('wallet:nfas', { ids: [], summaries: {} });
      setBootProgress(0);
      setStatus('ready');
      return;
    }

    if (address) {
      eventBus.emit('wallet:connected', { address });
    }

    setStatus((current) => (
      current === 'playing' || current === 'loading-nfa' || current === 'select-nfa' || current === 'no-nfa' || current === 'booting'
        ? current
        : 'connected'
    ));
  }, [address, isConnected, mounted]);

  const startGameBoot = useCallback(async () => {
    if (!isConnected || !address) return;

    setStatus('booting');
    setBootProgress(0);

    let intervalId: number | undefined;

    try {
      const startAt = Date.now();
      const minDuration = 1800;

      intervalId = window.setInterval(() => {
        const elapsed = Date.now() - startAt;
        const progress = Math.min(95, Math.floor((elapsed / minDuration) * 100));
        setBootProgress(progress);
      }, 60);

      const ids = await refreshOwnedNfas();
      const elapsed = Date.now() - startAt;
      if (elapsed < minDuration) {
        await new Promise((resolve) => window.setTimeout(resolve, minDuration - elapsed));
      }

      if (intervalId) window.clearInterval(intervalId);
      setBootProgress(100);

      await new Promise((resolve) => window.setTimeout(resolve, 220));

      if (ids.length === 0) {
        setStatus('no-nfa');
      } else {
        setStatus('select-nfa');
      }
    } catch (error) {
      if (intervalId) window.clearInterval(intervalId);
      console.error('Failed to boot game:', error);
      setStatus('error');
    }
  }, [address, isConnected, refreshOwnedNfas]);

  useEffect(() => {
    if (status !== 'playing' || !activeNfaId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshActiveNfaState(activeNfaId);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [activeNfaId, refreshActiveNfaState, status]);

  useEffect(() => {
    eventBus.emit('wallet:nfas', { ids: nfaList, summaries: nfaSummaries });
  }, [nfaList, nfaSummaries]);

  useEffect(() => {
    const unsubscribe = eventBus.on('wallet:nfas:request', () => {
      eventBus.emit('wallet:nfas', { ids: nfaList, summaries: nfaSummaries });
    });
    return () => unsubscribe();
  }, [nfaList, nfaSummaries]);

  useEffect(() => {
    if (!mounted) return;

    const tryProcessUpkeep = async (nfaId: number) => {
      try {
        const upkeepHash = await writeContractAsync(processUpkeepArgs(nfaId));
        await waitForReceipt(upkeepHash, 'PROCESSING UPKEEP');
      } catch {
        // Upkeep frequently reverts when no upkeep is needed; ignore it.
      }
    };

    const emitPkMatches = async () => {
      const matches = await loadRecentMatches();
      eventBus.emit('pk:matches', matches.map((match) => ({
        matchId: match.matchId,
        nfaA: match.nfaA,
        nfaB: match.nfaB,
        stake: formatEther(match.stake),
        phase: match.phase,
        phaseName: PK_PHASE_NAMES[match.phase] || String(match.phase),
        phaseTimestamp: match.phaseTimestamp,
        revealedA: match.revealedA,
        revealedB: match.revealedB,
      })));
    };

    const emitMarketListings = async () => {
      const listings = await loadMarketListings();
      eventBus.emit('market:listings', listings.map((listing) => ({
        listingId: listing.listingId,
        nfaId: listing.nfaId,
        seller: listing.seller,
        listingType: listing.listingType,
        price: formatEther(listing.price),
        highestBid: formatEther(listing.highestBid),
        highestBidder: listing.highestBidder,
        endTime: listing.endTime,
        swapTargetId: listing.swapTargetId,
        rarity: listing.rarity,
      })));
    };

    const unsubTask = eventBus.on('task:submit', async (...args: unknown[]) => {
      const data = args[0] as { nfaId: number; taskType: number; xp: number; clw: number; matchScore: number };
      try {
        await tryProcessUpkeep(data.nfaId);

        const hash = await writeContractAsync(taskSubmitArgs(data.nfaId, data.taskType, data.xp, data.clw, data.matchScore));
        eventBus.emit('task:result', { status: 'pending', txHash: hash });

        const receipt = await waitForReceipt(hash, 'SUBMITTING TASK');
        if (receipt.status !== 'success') throw new Error('Task transaction reverted');

        await refreshActiveNfaState(data.nfaId);

        const completed = getReceiptEventArgs(TaskSkillABI, receipt, addresses.taskSkill, 'TaskCompleted');
        eventBus.emit('task:result', {
          status: 'confirmed',
          txHash: hash,
          actualClw: completed?.actualClw ? formatEther(completed.actualClw as bigint) : undefined,
        });
      } catch (error) {
        console.error('Task submit failed:', error);
        eventBus.emit('task:result', { status: 'failed', error: getErrorMessage(error) });
      }
    });

    const unsubPKCreate = eventBus.on('pk:create', async (...args: unknown[]) => {
      const data = args[0] as { nfaId: number; strategy: number; stake: string };
      try {
        if (!address) throw new Error('Wallet not connected');

        const { commitHash, salt } = generateCommit(data.strategy, address as Address);
        const hash = await writeContractAsync(pkCreateArgs(data.nfaId, parseEther(data.stake), commitHash));
        eventBus.emit('pk:result', { status: 'pending', action: 'create', txHash: hash });

        const receipt = await waitForReceipt(hash, 'CREATING PK MATCH');
        if (receipt.status !== 'success') throw new Error('PK create transaction reverted');

        const created = getReceiptEventArgs(PKSkillABI, receipt, addresses.pkSkill, 'MatchCreated');
        const matchId = created?.matchId ? Number(created.matchId) : null;
        if (!matchId) throw new Error('Could not read matchId from receipt');

        savePKSalt(matchId, data.strategy, salt);
        await refreshActiveNfaState(data.nfaId);
        await emitPkMatches();

        eventBus.emit('pk:result', {
          status: 'confirmed',
          action: 'create',
          txHash: hash,
          matchId,
        });
      } catch (error) {
        console.error('PK create failed:', error);
        eventBus.emit('pk:result', { status: 'failed', action: 'create', error: getErrorMessage(error) });
      }
    });

    const unsubPKJoin = eventBus.on('pk:join', async (...args: unknown[]) => {
      const data = args[0] as { nfaId: number; matchId: number; strategy: number };
      try {
        if (!address) throw new Error('Wallet not connected');

        const match = await loadMatch(data.matchId);
        if (!match) throw new Error('Match not found');

        const { commitHash, salt } = generateCommit(data.strategy, address as Address);
        const hash = await writeContractAsync(pkJoinArgs(data.matchId, data.nfaId, commitHash));
        eventBus.emit('pk:result', { status: 'pending', action: 'join', txHash: hash, matchId: data.matchId });

        const receipt = await waitForReceipt(hash, 'JOINING PK MATCH');
        if (receipt.status !== 'success') throw new Error('PK join transaction reverted');

        savePKSalt(data.matchId, data.strategy, salt);
        await refreshActiveNfaState(data.nfaId);
        await emitPkMatches();

        eventBus.emit('pk:result', {
          status: 'confirmed',
          action: 'join',
          txHash: hash,
          matchId: data.matchId,
          stake: formatEther(match.stake),
        });
      } catch (error) {
        console.error('PK join failed:', error);
        eventBus.emit('pk:result', { status: 'failed', action: 'join', matchId: data.matchId, error: getErrorMessage(error) });
      }
    });

    const unsubPKSearch = eventBus.on('pk:search', async () => {
      try {
        await emitPkMatches();
      } catch (error) {
        console.error('PK search failed:', error);
        eventBus.emit('pk:matches', []);
      }
    });

    const unsubPKReveal = eventBus.on('pk:reveal', async (...args: unknown[]) => {
      const data = args[0] as { matchId: number };
      try {
        const saved = loadPKSalt(data.matchId);
        if (!saved) throw new Error(`No saved strategy for match #${data.matchId}`);

        const hash = await writeContractAsync(pkRevealArgs(data.matchId, saved.strategy, saved.salt as `0x${string}`));
        eventBus.emit('pk:result', { status: 'pending', action: 'reveal', txHash: hash, matchId: data.matchId });

        const receipt = await waitForReceipt(hash, 'REVEALING STRATEGY');
        if (receipt.status !== 'success') throw new Error('Reveal transaction reverted');

        localStorage.removeItem(`claw-pk-${data.matchId}`);
        await emitPkMatches();

        const match = await loadMatch(data.matchId);
        eventBus.emit('pk:result', {
          status: 'confirmed',
          action: 'reveal',
          txHash: hash,
          matchId: data.matchId,
          phase: match?.phase,
        });
      } catch (error) {
        console.error('PK reveal failed:', error);
        eventBus.emit('pk:result', { status: 'failed', action: 'reveal', matchId: data.matchId, error: getErrorMessage(error) });
      }
    });

    const unsubPKSettle = eventBus.on('pk:settle', async (...args: unknown[]) => {
      const data = args[0] as { matchId: number };
      try {
        const hash = await writeContractAsync(pkSettleArgs(data.matchId));
        eventBus.emit('pk:result', { status: 'pending', action: 'settle', txHash: hash, matchId: data.matchId });

        const receipt = await waitForReceipt(hash, 'SETTLING PK MATCH');
        if (receipt.status !== 'success') throw new Error('Settle transaction reverted');

        await refreshActiveNfaState();
        await emitPkMatches();

        const settled = getReceiptEventArgs(PKSkillABI, receipt, addresses.pkSkill, 'MatchSettled');
        if (settled?.winner && settled?.loser && settled?.reward && settled?.burned) {
          savePKResolutionCache({
            type: 'settled',
            matchId: data.matchId,
            winnerNfaId: Number(settled.winner),
            loserNfaId: Number(settled.loser),
            reward: formatEther(settled.reward as bigint),
            burned: formatEther(settled.burned as bigint),
            txHash: hash,
            ts: Date.now(),
          });
        }
        eventBus.emit('pk:result', {
          status: 'confirmed',
          action: 'settle',
          txHash: hash,
          matchId: data.matchId,
          winnerNfaId: settled?.winner ? Number(settled.winner) : undefined,
          loserNfaId: settled?.loser ? Number(settled.loser) : undefined,
          reward: settled?.reward ? formatEther(settled.reward as bigint) : undefined,
        });
      } catch (error) {
        console.error('PK settle failed:', error);
        eventBus.emit('pk:result', { status: 'failed', action: 'settle', matchId: data.matchId, error: getErrorMessage(error) });
      }
    });

    const unsubPKCancel = eventBus.on('pk:cancel', async (...args: unknown[]) => {
      const data = args[0] as { matchId: number };
      try {
        const match = await loadMatch(data.matchId);
        if (!match) throw new Error('Match not found');
        if (match.phase > 2) throw new Error('Only OPEN/JOINED/COMMITTED matches can be cancelled');

        const hash = await writeContractAsync(pkCancelArgs(data.matchId, match.phase));
        eventBus.emit('pk:result', { status: 'pending', action: 'cancel', txHash: hash, matchId: data.matchId });

        const receipt = await waitForReceipt(hash, 'CANCELLING PK MATCH');
        if (receipt.status !== 'success') throw new Error('Cancel transaction reverted');

        await refreshActiveNfaState();
        await emitPkMatches();

        savePKResolutionCache({
          type: 'cancelled',
          matchId: data.matchId,
          txHash: hash,
          ts: Date.now(),
        });
        eventBus.emit('pk:result', {
          status: 'confirmed',
          action: 'cancel',
          txHash: hash,
          matchId: data.matchId,
        });
      } catch (error) {
        console.error('PK cancel failed:', error);
        eventBus.emit('pk:result', { status: 'failed', action: 'cancel', matchId: data.matchId, error: getErrorMessage(error) });
      }
    });

    const unsubMarketRequest = eventBus.on('market:requestListings', async () => {
      try {
        await emitMarketListings();
      } catch (error) {
        console.error('Market listings failed:', error);
        eventBus.emit('market:listings', []);
      }
    });

    const unsubMarketBuy = eventBus.on('market:buy', async (...args: unknown[]) => {
      const data = args[0] as { listingId: number; price: string };
      try {
        const hash = await writeContractAsync(marketBuyArgs(data.listingId, parseEther(data.price)));
        eventBus.emit('market:result', { status: 'pending', action: 'buy', txHash: hash, listingId: data.listingId });

        const receipt = await waitForReceipt(hash, 'BUYING NFA');
        if (receipt.status !== 'success') throw new Error('Buy transaction reverted');

        await syncAfterOwnershipChange();
        await emitMarketListings();

        eventBus.emit('market:result', { status: 'confirmed', action: 'buy', txHash: hash, listingId: data.listingId });
      } catch (error) {
        console.error('Market buy failed:', error);
        eventBus.emit('market:result', { status: 'failed', action: 'buy', error: getErrorMessage(error) });
      }
    });

    const unsubMarketBid = eventBus.on('market:bid', async (...args: unknown[]) => {
      const data = args[0] as { listingId: number; amount: string };
      try {
        const hash = await writeContractAsync(marketBidArgs(data.listingId, parseEther(data.amount)));
        eventBus.emit('market:result', { status: 'pending', action: 'bid', txHash: hash, listingId: data.listingId });

        const receipt = await waitForReceipt(hash, 'PLACING BID');
        if (receipt.status !== 'success') throw new Error('Bid transaction reverted');

        await emitMarketListings();
        eventBus.emit('market:result', { status: 'confirmed', action: 'bid', txHash: hash, listingId: data.listingId });
      } catch (error) {
        console.error('Market bid failed:', error);
        eventBus.emit('market:result', { status: 'failed', action: 'bid', error: getErrorMessage(error) });
      }
    });

    const unsubMarketSettle = eventBus.on('market:settle', async (...args: unknown[]) => {
      const data = args[0] as { listingId: number };
      try {
        const hash = await writeContractAsync(marketSettleAuctionArgs(data.listingId));
        eventBus.emit('market:result', { status: 'pending', action: 'settle', txHash: hash, listingId: data.listingId });

        const receipt = await waitForReceipt(hash, 'SETTLING AUCTION');
        if (receipt.status !== 'success') throw new Error('Auction settle transaction reverted');

        await syncAfterOwnershipChange();
        await emitMarketListings();

        eventBus.emit('market:result', { status: 'confirmed', action: 'settle', txHash: hash, listingId: data.listingId });
      } catch (error) {
        console.error('Market settle failed:', error);
        eventBus.emit('market:result', { status: 'failed', action: 'settle', error: getErrorMessage(error) });
      }
    });

    const unsubMarketCancel = eventBus.on('market:cancel', async (...args: unknown[]) => {
      const data = args[0] as { listingId: number };
      try {
        const hash = await writeContractAsync(marketCancelArgs(data.listingId));
        eventBus.emit('market:result', { status: 'pending', action: 'cancel', txHash: hash, listingId: data.listingId });

        const receipt = await waitForReceipt(hash, 'CANCELLING LISTING');
        if (receipt.status !== 'success') throw new Error('Cancel listing transaction reverted');

        await syncAfterOwnershipChange();
        await emitMarketListings();

        eventBus.emit('market:result', { status: 'confirmed', action: 'cancel', txHash: hash, listingId: data.listingId });
      } catch (error) {
        console.error('Market cancel failed:', error);
        eventBus.emit('market:result', { status: 'failed', action: 'cancel', error: getErrorMessage(error) });
      }
    });

    const unsubMarketAcceptSwap = eventBus.on('market:acceptSwap', async (...args: unknown[]) => {
      const data = args[0] as { listingId: number; targetNfaId: number };
      try {
        const approveHash = await writeContractAsync(nfaApproveArgs(data.targetNfaId));
        await waitForReceipt(approveHash, 'APPROVING SWAP NFA');

        const hash = await writeContractAsync(marketAcceptSwapArgs(data.listingId));
        eventBus.emit('market:result', { status: 'pending', action: 'acceptSwap', txHash: hash, listingId: data.listingId });

        const receipt = await waitForReceipt(hash, 'ACCEPTING SWAP');
        if (receipt.status !== 'success') throw new Error('Accept swap transaction reverted');

        await syncAfterOwnershipChange();
        await emitMarketListings();

        eventBus.emit('market:result', { status: 'confirmed', action: 'acceptSwap', txHash: hash, listingId: data.listingId });
      } catch (error) {
        console.error('Accept swap failed:', error);
        eventBus.emit('market:result', { status: 'failed', action: 'acceptSwap', error: getErrorMessage(error) });
      }
    });

    const unsubMarketList = eventBus.on('market:list', async (...args: unknown[]) => {
      const data = args[0] as { nfaId: number; price?: string; mode: 'fixed' | 'auction' | 'swap'; targetNfaId?: number };
      try {
        const approveHash = await writeContractAsync(nfaApproveArgs(data.nfaId));
        await waitForReceipt(approveHash, 'APPROVING NFA');

        const txArgs = data.mode === 'swap'
          ? marketSwapArgs(data.nfaId, Number(data.targetNfaId))
          : data.mode === 'auction'
            ? marketAuctionArgs(data.nfaId, parseEther(String(data.price)))
            : marketListArgs(data.nfaId, parseEther(String(data.price)));

        const hash = await writeContractAsync(txArgs);
        eventBus.emit('market:result', { status: 'pending', action: 'list', txHash: hash, nfaId: data.nfaId });

        const receipt = await waitForReceipt(
          hash,
          data.mode === 'swap' ? 'LISTING SWAP' : data.mode === 'auction' ? 'CREATING AUCTION' : 'LISTING NFA'
        );
        if (receipt.status !== 'success') throw new Error('List transaction reverted');

        const listed = getReceiptEventArgs(MarketSkillABI, receipt, addresses.marketSkill, 'Listed');
        await syncAfterOwnershipChange();
        await emitMarketListings();

        eventBus.emit('market:result', {
          status: 'confirmed',
          action: 'list',
          txHash: hash,
          nfaId: data.nfaId,
          listingId: listed?.listingId ? Number(listed.listingId) : undefined,
        });
      } catch (error) {
        console.error('Market list failed:', error);
        eventBus.emit('market:result', { status: 'failed', action: 'list', error: getErrorMessage(error) });
      }
    });

    return () => {
      unsubTask();
      unsubPKCreate();
      unsubPKJoin();
      unsubPKSearch();
      unsubPKReveal();
      unsubPKSettle();
      unsubPKCancel();
      unsubMarketRequest();
      unsubMarketBuy();
      unsubMarketBid();
      unsubMarketSettle();
      unsubMarketCancel();
      unsubMarketAcceptSwap();
      unsubMarketList();
    };
  }, [
    address,
    mounted,
    refreshActiveNfaState,
    syncAfterOwnershipChange,
    waitForReceipt,
    writeContractAsync,
  ]);

  useEffect(() => {
    const unsubscribe = eventBus.on('game:openclaw', () => setShowOpenClaw(true));
    return () => unsubscribe();
  }, []);

  const shellWalletOptions = walletOptions.map((item) => ({ id: item.id, name: item.name }));
  const showStartupCard = status !== 'playing';
  const showFloatingHud = status === 'playing' || !showStartupCard;
  const compactStatusHeadline = (() => {
    if (lang === 'zh') {
      if (status === 'ready') return '请先连接钱包';
      if (status === 'connected') return '钱包已连接，请点击同步读取龙虾';
      if (!isConnected) return '按 Tab 打开控制台，先连接钱包';
      if (status === 'booting') return `正在同步链上数据 ${bootProgress}%`;
      if (status === 'no-nfa') return '当前钱包没有 NFA，请先铸造';
      if (status === 'select-nfa') return '同步完成，请在控制台选择 NFA';
      if (status === 'loading-nfa') return '正在载入龙虾状态';
      if (status === 'playing' && activeSummary) return `已进入 NFA #${activeSummary.tokenId}`;
      if (status === 'error') return '会话加载失败，请刷新后重试';
      return '等待进入会话';
    }

    if (status === 'ready') return 'Connect wallet first';
    if (status === 'connected') return 'Wallet connected. Click sync to fetch NFAs';
    if (!isConnected) return 'Press Tab to connect your wallet';
    if (status === 'booting') return `Syncing on-chain data ${bootProgress}%`;
    if (status === 'no-nfa') return 'No NFA found for this wallet';
    if (status === 'select-nfa') return 'Sync complete. Choose an NFA in the panel';
    if (status === 'loading-nfa') return 'Loading lobster state';
    if (status === 'playing' && activeSummary) return `Entered with NFA #${activeSummary.tokenId}`;
    if (status === 'error') return 'Session failed. Refresh and retry';
    return 'Waiting to enter session';
  })();
  const compactStatusDetail = activeSummary
    ? (lang === 'zh'
      ? `等级 ${activeSummary.level} · Claworld ${activeSummary.clwBalance.toFixed(0)}`
      : `Lv.${activeSummary.level} · Claworld ${activeSummary.clwBalance.toFixed(0)}`)
    : (lang === 'zh'
      ? '同步后请直接在这里选择龙虾，进入避难所。'
      : 'Sync first, then select an NFA here to enter the shelter.');

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-crt-green font-mono text-xs animate-pulse">
          {lang === 'zh' ? '正在初始化游戏场景...' : 'INITIALIZING GAME...'}
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 items-center justify-center overflow-hidden">
      <div
        ref={containerRef}
        className="absolute z-[20] rounded bg-black"
        style={{ width: gameViewportStyle.width, height: gameViewportStyle.height }}
      />

      {showFloatingHud && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[30]">
          <div className="flex items-end justify-between gap-3 px-3 pb-3 sm:px-4 sm:pb-4">
            <div className="pointer-events-auto flex max-w-[78vw] flex-wrap items-center gap-2 font-mono text-[11px] sm:text-xs">
              <button
                onClick={() => setShowSidePanel((current) => !current)}
                className="rounded border border-crt-green/20 bg-black/45 px-2.5 py-1.5 text-crt-green/70 backdrop-blur-[2px] transition-colors hover:text-crt-bright"
              >
                {isCompactViewport ? (lang === 'zh' ? '[ 菜单 ]' : '[ MENU ]') : `[TAB] ${lang === 'zh' ? '控制台' : 'CONSOLE'}`}
              </button>
              <button
                onClick={() => setShowHelpPanel(true)}
                className="rounded border border-crt-green/20 bg-black/45 px-2.5 py-1.5 text-crt-green/70 backdrop-blur-[2px] transition-colors hover:text-crt-bright"
              >
                {isCompactViewport ? (lang === 'zh' ? '[ 帮助 ]' : '[ HELP ]') : `[H] ${lang === 'zh' ? '帮助' : 'HELP'}`}
              </button>
              {activeSummary && (
                <div className="rounded border border-crt-green/15 bg-black/40 px-2.5 py-1.5 text-crt-green/55 backdrop-blur-[2px]">
                  NFA #{activeSummary.tokenId} · Lv.{activeSummary.level}
                </div>
              )}
            </div>

            {pendingTx && (
              <div className="pointer-events-auto max-w-[58vw] rounded border border-crt-green/25 bg-black/58 px-3 py-2 font-mono text-[10px] text-right text-crt-green/85 shadow-[0_0_18px_rgba(82,255,82,0.12)] backdrop-blur-[2px] animate-pulse sm:text-[11px]">
                <div>{txLabel(pendingTx.label, lang === 'zh')}</div>
                <div className="text-crt-green/40">{pendingTx.hash.slice(0, 12)}...</div>
              </div>
            )}
          </div>
        </div>
      )}

      {showStartupCard && (
        <div className="pointer-events-none absolute inset-0 z-[35] flex items-center justify-center p-3 sm:p-4">
          <div className="pointer-events-auto w-[min(94vw,36rem)] rounded border border-crt-green/35 bg-black/72 font-mono shadow-[0_0_40px_rgba(82,255,82,0.14)] backdrop-blur-sm">
            <div className="border-b border-crt-green/25 px-4 py-4">
              <p className="text-[10px] tracking-[0.28em] text-crt-green/40">
                {lang === 'zh' ? '进入流程' : 'SESSION FLOW'}
              </p>
              <p className="mt-1 text-sm text-crt-bright">{compactStatusHeadline}</p>
              <p className="mt-1 text-xs text-crt-green/55">{compactStatusDetail}</p>
            </div>

            <div className="space-y-4 px-4 py-4">
              {(status === 'ready' || status === 'connected' || status === 'booting') && (
                <>
                  <div className="text-xs text-crt-green/65">
                    {isConnected && address
                      ? `${lang === 'zh' ? '已连接钱包' : 'Connected wallet'}: ${address.slice(0, 6)}...${address.slice(-4)}`
                      : (lang === 'zh' ? '请先选择并连接钱包' : 'Select and connect a wallet first')}
                  </div>

                  {!isConnected && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {walletOptions.map((connector) => (
                        <button
                          key={connector.id}
                          onClick={() => connectWallet(connector.name)}
                          className="soft-key py-3 text-xs sm:text-sm"
                        >
                          {connector.name === 'Injected'
                            ? (lang === 'zh' ? '浏览器钱包' : 'Browser Wallet')
                            : connector.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => void startGameBoot()}
                    disabled={!isConnected || status === 'booting'}
                    className="soft-key w-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {status === 'booting'
                      ? (lang === 'zh' ? '[ 同步中... ]' : '[ SYNCING... ]')
                      : (lang === 'zh' ? '[ 同步并读取龙虾 ]' : '[ SYNC AND LOAD NFA ]')}
                  </button>

                  <div>
                    <div className="h-2 w-full border border-crt-green/20 bg-black/70">
                      <div
                        className="h-full bg-crt-green/70 transition-all duration-100"
                        style={{ width: `${bootProgress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-crt-green/45">
                      {status === 'booting'
                        ? (lang === 'zh' ? `正在同步链上数据 ${bootProgress}%` : `Syncing on-chain data ${bootProgress}%`)
                        : (lang === 'zh' ? '同步完成后会出现龙虾选择' : 'NFA selection will appear after sync')}
                    </p>
                  </div>
                </>
              )}

              {status === 'no-nfa' && (
                <div className="space-y-3">
                  <p className="text-sm text-crt-green">
                    {lang === 'zh' ? '未检测到龙虾 NFA' : 'No lobster NFA detected'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => router.push('/mint')}
                      className="soft-key px-4 py-2 text-xs"
                    >
                      {lang === 'zh' ? '[ 去铸造 ]' : '[ MINT ]'}
                    </button>
                    <button
                      onClick={() => setShowSidePanel(true)}
                      className="soft-key px-4 py-2 text-xs"
                    >
                      {lang === 'zh' ? '[ 打开控制台 ]' : '[ OPEN CONSOLE ]'}
                    </button>
                  </div>
                </div>
              )}

              {status === 'select-nfa' && (
                <div className="space-y-3">
                  <p className="text-sm text-crt-green">
                    {lang === 'zh' ? '选择你的龙虾进入避难所' : 'Choose your lobster to enter the shelter'}
                  </p>
                  <div className="grid max-h-[52vh] gap-2 overflow-y-auto pr-1">
                    {nfaList.map((id) => {
                      const summary = nfaSummaries[id];
                      return (
                        <button
                          key={id}
                          onClick={() => void selectAndEnter(id)}
                          className="rounded border border-crt-green/20 bg-black/70 px-3 py-3 text-left transition-colors hover:border-crt-green/60 hover:bg-crt-green/5"
                        >
                          <div className="text-sm text-crt-bright">NFA #{id}</div>
                          <div className="mt-1 text-[11px] text-crt-green/45">{getLobsterName(id)}</div>
                          {summary && (
                            <div className="mt-2 text-xs text-crt-green/65">
                              <div>Lv.{summary.level} · {getRarityName(summary.rarity, lang === 'zh')}</div>
                              <div>{getShelterName(summary.shelter)} · Claworld {summary.clwBalance.toFixed(0)}</div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(status === 'loading' || status === 'loading-nfa') && (
                <div className="space-y-2 text-sm text-crt-green animate-pulse">
                  <p>
                    {status === 'loading-nfa'
                      ? (lang === 'zh' ? '正在读取龙虾状态并进入避难所...' : 'Loading lobster state and entering shelter...')
                      : (lang === 'zh' ? '正在初始化引擎...' : 'Initializing engine...')}
                  </p>
                </div>
              )}

              {status === 'error' && (
                <div className="space-y-3">
                  <p className="text-sm text-red-400">
                    {lang === 'zh' ? '加载失败，请重试' : 'Load failed. Retry.'}
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="soft-key px-4 py-2 text-xs"
                  >
                    {lang === 'zh' ? '[ 刷新重试 ]' : '[ REFRESH ]'}
                  </button>
                </div>
              )}

              <div className="border-t border-crt-green/15 pt-3 text-[11px] text-crt-green/45">
                {lang === 'zh'
                  ? '原始游戏场景已保留。你也可以按 Tab 打开侧边控制台操作。'
                  : 'The original game scene stays active. You can also press Tab to use the side console.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {showSidePanel && (
        <div className="absolute inset-0 z-[40] bg-black/45 backdrop-blur-[2px]" onClick={() => setShowSidePanel(false)}>
          <div
            className="absolute left-0 top-0 h-full w-[min(94vw,24rem)] border-r border-crt-green/35 bg-black/92 shadow-[0_0_40px_rgba(0,0,0,0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <GameCommandShell
              lang={lang}
              status={status}
              isConnected={isConnected}
              address={address}
              bootProgress={bootProgress}
              walletOptions={shellWalletOptions}
              selectedConnectorId={selectedConnectorId}
              nfaList={nfaList}
              nfaSummaries={nfaSummaries}
              activeNfaId={activeNfaId}
              activeSummary={activeSummary}
              pendingTx={pendingTx}
              onConnectWallet={connectWallet}
              onSync={() => { void startGameBoot(); }}
              onSelectNfa={(nfaId) => { void selectAndEnter(nfaId); }}
              onToggleMenu={() => setShowSidePanel((current) => !current)}
              onOpenHelp={() => setShowHelpPanel(true)}
              onOpenHome={() => router.push('/')}
              onOpenMint={() => router.push('/mint')}
              onOpenNfa={() => router.push('/nfa')}
              onOpenOpenClaw={() => setShowOpenClaw(true)}
              onToggleLang={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            />
          </div>
        </div>
      )}

      {showHelpPanel && (
        <div className="absolute inset-0 z-[45] bg-black/80 p-3 sm:p-6" onClick={() => setShowHelpPanel(false)}>
          <div
            className="mx-auto mt-4 sm:mt-10 max-w-2xl border border-crt-green/30 bg-black/95 p-4 sm:p-6 font-mono text-xs sm:text-sm text-crt-green/70 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-crt-green text-sm sm:text-lg">{lang === 'zh' ? '操作与功能总览' : 'Controls & Features'}</p>
              <button
                onClick={() => setShowHelpPanel(false)}
                className="soft-key px-3 py-1 text-xs"
              >
                {lang === 'zh' ? '[ 关闭 ]' : '[ CLOSE ]'}
              </button>
            </div>

            <div className="border-t border-crt-green/15 pt-3 space-y-2">
              <p className="term-bright">{lang === 'zh' ? '基础操作' : 'Controls'}</p>
              <p>{lang === 'zh' ? 'WASD / 方向键：移动' : 'WASD / Arrow keys: move'}</p>
              <p>{lang === 'zh' ? '点击地面 / 触屏：移动到目标点' : 'Tap/click ground: move to point'}</p>
              <p>{lang === 'zh' ? 'SPACE：靠近装置后交互' : 'SPACE: interact near terminals'}</p>
              <p>{lang === 'zh' ? 'TAB：打开快捷控制台' : 'TAB: open quick console'}</p>
              <p>{lang === 'zh' ? 'ESC：关闭面板 / 返回' : 'ESC: close panel / back'}</p>
            </div>

            <div className="border-t border-crt-green/15 pt-3 space-y-2">
              <p className="term-bright">{lang === 'zh' ? '链上功能入口' : 'On-chain Functions'}</p>
              <p>{lang === 'zh' ? '任务终端：生成任务并链上提交' : 'Task terminal: generate tasks and submit on-chain'}</p>
              <p>{lang === 'zh' ? '竞技场：创建或加入后自动推进对局结果，必要时可取消卡住的对局' : 'Arena: create or join, then auto-advance the match flow; cancel only when stuck'}</p>
              <p>{lang === 'zh' ? '交易墙：固定价、拍卖、互换、购买、出价、取消、结算' : 'Market wall: fixed price, auction, swap, buy, bid, cancel, settle'}</p>
              <p>{lang === 'zh' ? '避难所传送：切换 shelter' : 'Portal: switch shelters'}</p>
              <p>{lang === 'zh' ? 'OpenClaw：打开 AI 入口' : 'OpenClaw: open the AI entry'}</p>
            </div>
          </div>
        </div>
      )}

      {showOpenClaw && (
        <div className="absolute inset-0 flex items-center justify-center z-[50] bg-black/80 p-4">
          <div className="max-w-md p-6 border border-crt-green/30 bg-black/95 font-mono text-center">
            <p className="text-white text-sm mb-2">{lang === 'zh' ? '[ 意识唤醒舱 ]' : '[ AWAKENING POD ]'}</p>
            <p className="text-crt-green/70 text-xs mb-4">
              {lang === 'zh'
                ? '安装 OpenClaw 后，你的龙虾将获得真正的 AI 意识，能够对话、保留记忆并参与长期成长。'
                : 'Install OpenClaw to give your lobster true AI consciousness with dialogue, memory, and long-term growth.'}
            </p>
            <div className="bg-crt-green/10 p-3 mb-4 text-[11px] text-crt-green">
              <code>openclaw skills install claw-world</code>
            </div>
            <div className="flex gap-3 justify-center">
              <a
                href="https://clawhub.ai/skills/claw-world"
                target="_blank"
                rel="noopener noreferrer"
                className="soft-key text-xs px-4 py-2"
              >
                {lang === 'zh' ? '[ 查看详情 ]' : '[ DETAILS ]'}
              </a>
              <button
                onClick={() => setShowOpenClaw(false)}
                className="text-xs text-crt-green/40 hover:text-crt-green/80 px-4 py-2"
              >
                {lang === 'zh' ? '[ 关闭 ]' : '[ CLOSE ]'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
