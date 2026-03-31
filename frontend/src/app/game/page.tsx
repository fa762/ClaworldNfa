'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useConnect, useWriteContract } from 'wagmi';
import { decodeEventLog, formatEther, parseEther, type Address, type TransactionReceipt } from 'viem';
import Link from 'next/link';

import { eventBus } from '@/game/EventBus';
import {
  loadMatch,
  loadMarketListings,
  loadNFAState,
  loadPlayerNFAs,
  loadRecentMatches,
  publicClient,
} from '@/game/chain/wallet';
import {
  generateCommit,
  loadPKSalt,
  marketAuctionArgs,
  marketBidArgs,
  marketBuyArgs,
  marketCancelArgs,
  marketListArgs,
  marketSettleAuctionArgs,
  nfaApproveArgs,
  pkCancelArgs,
  pkCreateArgs,
  pkJoinArgs,
  pkRevealArgs,
  pkSettleArgs,
  processUpkeepArgs,
  savePKSalt,
  taskSubmitArgs,
} from '@/game/chain/contracts';
import { addresses } from '@/contracts/addresses';
import { MarketSkillABI } from '@/contracts/abis/MarketSkill';
import { PKSkillABI } from '@/contracts/abis/PKSkill';
import { TaskSkillABI } from '@/contracts/abis/TaskSkill';
import { useI18n } from '@/lib/i18n';

type GameStatus = 'loading' | 'ready' | 'connected' | 'booting' | 'no-nfa' | 'select-nfa' | 'loading-nfa' | 'playing' | 'error';
type PendingTx = { hash: `0x${string}`; label: string } | null;

const PK_PHASE_NAMES = ['OPEN', 'JOINED', 'COMMITTED', 'REVEALED', 'SETTLED', 'CANCELLED'];

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Transaction failed';

  if (error.message.includes('User rejected')) return 'User rejected transaction';
  if (error.message.includes('Cooldown active')) return 'Task cooldown is still active';
  if (error.message.includes('Not NFA owner')) return 'Current wallet does not own this NFA';
  if (error.message.includes('Insufficient CLW')) return 'Not enough CLW balance';
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

  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { writeContractAsync } = useWriteContract();
  const { lang } = useI18n();

  const [status, setStatus] = useState<GameStatus>('loading');
  const [nfaList, setNfaList] = useState<number[]>([]);
  const [mounted, setMounted] = useState(false);
  const [pendingTx, setPendingTx] = useState<PendingTx>(null);
  const [showOpenClaw, setShowOpenClaw] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);

  const walletOptions = useMemo(
    () => connectors.filter((connector) => connector.type === 'injected' || connector.name === 'WalletConnect' || connector.name === 'Coinbase Wallet'),
    [connectors],
  );

  useEffect(() => setMounted(true), []);

  const emitNfaState = useCallback((nfaId: number, state: Awaited<ReturnType<typeof loadNFAState>>) => {
    eventBus.emit('nfa:stats', {
      clw: state.clwBalance.toFixed(0),
      level: state.level,
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
      setStatus(ids.length === 0 ? 'no-nfa' : 'select-nfa');
    }

    return ids;
  }, [refreshOwnedNfas]);

  const selectAndEnter = useCallback(async (nfaId: number) => {
    setStatus('loading-nfa');
    activeNfaIdRef.current = nfaId;

    try {
      const state = await loadNFAState(nfaId);
      emitNfaState(nfaId, state);
      eventBus.emit('nfa:loaded', { nfaId, shelter: state.shelter });
      setStatus('playing');
    } catch (error) {
      console.error('Failed to load NFA state:', error);
      setStatus('error');
    }
  }, [emitNfaState]);

  useEffect(() => {
    if (!mounted || !containerRef.current || gameRef.current) return;

    import('@/game/main').then(({ createGame }) => {
      if (containerRef.current && !gameRef.current) {
        gameRef.current = createGame(containerRef.current);
        setStatus('ready');
      }
    }).catch((error) => {
      console.error('Phaser init failed:', error);
      setStatus('error');
    });

    return () => {
      if (gameRef.current) {
        (gameRef.current as { destroy: (removeCanvas?: boolean) => void }).destroy(true);
        gameRef.current = null;
      }
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    if (!isConnected) {
      activeNfaIdRef.current = null;
      setNfaList([]);
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
        eventBus.emit('pk:result', { status: 'failed', action: 'join', error: getErrorMessage(error) });
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
        eventBus.emit('pk:result', { status: 'failed', action: 'reveal', error: getErrorMessage(error) });
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
        eventBus.emit('pk:result', { status: 'failed', action: 'settle', error: getErrorMessage(error) });
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

        eventBus.emit('pk:result', {
          status: 'confirmed',
          action: 'cancel',
          txHash: hash,
          matchId: data.matchId,
        });
      } catch (error) {
        console.error('PK cancel failed:', error);
        eventBus.emit('pk:result', { status: 'failed', action: 'cancel', error: getErrorMessage(error) });
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

    const unsubMarketList = eventBus.on('market:list', async (...args: unknown[]) => {
      const data = args[0] as { nfaId: number; price: string; mode: 'fixed' | 'auction' };
      try {
        const approveHash = await writeContractAsync(nfaApproveArgs(data.nfaId));
        await waitForReceipt(approveHash, 'APPROVING NFA');

        const txArgs = data.mode === 'auction'
          ? marketAuctionArgs(data.nfaId, parseEther(data.price))
          : marketListArgs(data.nfaId, parseEther(data.price));

        const hash = await writeContractAsync(txArgs);
        eventBus.emit('market:result', { status: 'pending', action: 'list', txHash: hash, nfaId: data.nfaId });

        const receipt = await waitForReceipt(hash, data.mode === 'auction' ? 'CREATING AUCTION' : 'LISTING NFA');
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

  const isPlaying = status === 'playing';

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-crt-green font-mono text-xs animate-pulse">INITIALIZING...</p>
      </div>
    );
  }

  return (
    <>
      {/* Phaser 画布容器 — 始终在 DOM 中，playing 时全屏覆盖，否则隐藏在画面外 */}
      <div
        ref={containerRef}
        className={isPlaying
          ? 'fixed inset-0 z-[9999] bg-black'
          : 'fixed inset-0 -z-10 opacity-0 pointer-events-none'}
      />

      {/* 游戏内叠加层（返回按钮 + 交易提示）*/}
      {isPlaying && (
        <div className="fixed inset-0 z-[10000] pointer-events-none">
          <button
            onClick={() => router.push('/')}
            className="pointer-events-auto absolute top-3 left-3 font-mono text-sm text-crt-green/50 hover:text-crt-green transition-colors bg-black/60 px-3 py-1 border border-crt-green/20 hover:border-crt-green/50"
          >
            ◀ {lang === 'zh' ? '返回' : 'BACK'}
          </button>

          {pendingTx && (
            <div className="absolute top-3 right-3 text-[11px] font-mono text-crt-green/70 animate-pulse text-right bg-black/70 px-3 py-1 border border-crt-green/20">
              <div>{pendingTx.label}</div>
              <div className="text-crt-green/40">{pendingTx.hash.slice(0, 12)}...</div>
            </div>
          )}
        </div>
      )}

      {/* 大厅 UI — 在 CRT 终端页面内，selecting/booting 等状态显示 */}
      {!isPlaying && (
        <main className="max-w-2xl mx-auto px-4 py-10 min-h-[calc(100vh-160px)] flex flex-col items-center justify-center">
          <div className="w-full border border-crt-green/30 bg-black/80 px-8 py-8 font-mono shadow-[0_0_40px_rgba(57,255,20,0.06)]">

            <p className="text-crt-green/40 text-xs mb-6 tracking-widest">
              // SHELTER ACCESS TERMINAL
            </p>

            {/* 钱包连接 + 同步 */}
            {(status === 'ready' || status === 'connected' || status === 'booting') && (
              <>
                <div className="text-sm text-crt-green/60 mb-5 min-h-5">
                  {isConnected && address
                    ? `${lang === 'zh' ? '已连接' : 'Connected'}: ${address.slice(0, 6)}...${address.slice(-4)}`
                    : (lang === 'zh' ? '请选择并连接钱包' : 'Select and connect a wallet')}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 mb-5">
                  {walletOptions.map((connector) => (
                    <button
                      key={connector.id}
                      onClick={() => {
                        setSelectedConnectorId(connector.id);
                        connect({ connector });
                      }}
                      className={`soft-key py-3 text-sm ${selectedConnectorId === connector.id ? 'text-white' : ''}`}
                    >
                      {connector.name === 'Injected' ? '浏览器钱包 (MetaMask 等)' : connector.name}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => void startGameBoot()}
                  disabled={!isConnected || status === 'booting'}
                  className="soft-key w-full py-4 text-base mb-5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {status === 'booting'
                    ? (lang === 'zh' ? '[ 同步中... ]' : '[ SYNCING... ]')
                    : (lang === 'zh' ? '[ 进入游戏 ]' : '[ ENTER GAME ]')}
                </button>

                <div className="h-3 w-full border border-crt-green/30 bg-black/70 mb-1">
                  <div
                    className="h-full bg-crt-green/70 transition-all duration-100"
                    style={{ width: `${bootProgress}%` }}
                  />
                </div>
                <p className="text-xs text-crt-green/40 mb-6">{bootProgress}%</p>

                <Link href="/mint" className="text-xs text-crt-green/30 hover:text-crt-green/60 transition-colors">
                  {lang === 'zh' ? '还没有龙虾？去铸造 →' : 'No lobster? Mint one →'}
                </Link>
              </>
            )}

            {/* 未找到 NFA */}
            {status === 'no-nfa' && (
              <>
                <p className="text-crt-green text-lg mb-6">
                  {lang === 'zh' ? '未检测到龙虾 NFA' : 'No lobster NFA detected'}
                </p>
                <Link href="/mint" className="soft-key text-sm px-8 py-3">
                  {lang === 'zh' ? '[ 去铸造 ]' : '[ MINT NOW ]'}
                </Link>
              </>
            )}

            {/* 选择龙虾 */}
            {status === 'select-nfa' && (
              <>
                <p className="text-crt-green text-lg mb-2">
                  {lang === 'zh' ? '选择你的龙虾' : 'Choose your lobster'}
                </p>
                <p className="text-sm text-crt-green/50 mb-6">
                  {lang === 'zh' ? '同步完成，选择要进入避难所的龙虾。' : 'Sync complete. Select a lobster to enter the shelter.'}
                </p>
                <div className="flex gap-3 flex-wrap">
                  {nfaList.map((id) => (
                    <button
                      key={id}
                      onClick={() => selectAndEnter(id)}
                      className="soft-key text-base px-6 py-4"
                    >
                      NFA #{id}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* 加载中 */}
            {(status === 'loading' || status === 'loading-nfa') && (
              <p className="text-crt-green animate-pulse">
                {status === 'loading-nfa'
                  ? (lang === 'zh' ? '读取链上数据...' : 'READING CHAIN DATA...')
                  : (lang === 'zh' ? '初始化引擎...' : 'INITIALIZING ENGINE...')}
              </p>
            )}

            {/* 错误 */}
            {status === 'error' && (
              <>
                <p className="text-red-400 text-lg mb-4">
                  {lang === 'zh' ? '加载失败' : 'LOAD FAILED'}
                </p>
                <button onClick={() => window.location.reload()} className="soft-key text-sm px-6 py-3">
                  {lang === 'zh' ? '[ 重试 ]' : '[ RETRY ]'}
                </button>
              </>
            )}
          </div>
        </main>
      )}

      {/* OpenClaw 弹窗 */}
      {showOpenClaw && (
        <div className="fixed inset-0 flex items-center justify-center z-[10001] bg-black/80">
          <div className="max-w-md p-6 border border-crt-green/30 bg-black/95 font-mono text-center">
            <p className="text-white text-sm mb-2">{'[ 意识唤醒舱 ]'}</p>
            <p className="text-crt-green/70 text-xs mb-4">
              {lang === 'zh'
                ? '安装 OpenClaw 后，你的龙虾将获得真正的 AI 意识——能对话、有记忆、会做梦。'
                : 'Install OpenClaw to give your lobster true AI consciousness — dialogue, memory, dreams.'}
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
    </>
  );
}
