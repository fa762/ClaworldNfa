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

  const walletOptions = useMemo(
    () => connectors.filter((connector) => connector.type === 'injected' || connector.name === 'WalletConnect' || connector.name === 'Coinbase Wallet'),
    [connectors],
  );

  const activeSummary = activeNfaId ? nfaSummaries[activeNfaId] : undefined;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isConnected) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') { e.preventDefault(); setShowSidePanel(p => !p); }
      if (e.key.toLowerCase() === 'h') { e.preventDefault(); setShowHelpPanel(p => !p); }
      if (e.key === 'Escape') setShowSidePanel(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConnected]);

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
      eventBus.emit('game:switchNfa', {
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
      setStatus('playing');
    } catch (error) {
      console.error('Failed to load NFA state:', error);
      setStatus('error');
    }
  }, [emitNfaState, ensureGame]);

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

  const isPlaying = status === 'playing';
  const shouldMountGame = gameReady || status === 'loading-nfa' || status === 'playing';

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-crt-green font-mono text-xs animate-pulse">INITIALIZING...</p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0">
      {/* Phaser 画布容器 — 始终在 DOM 中，playing 时全屏覆盖，否则隐藏在画面外 */}
      <div
        ref={containerRef}
        className={shouldMountGame
          ? 'absolute inset-0 z-[20] bg-black rounded'
          : 'absolute inset-0 -z-10 opacity-0 pointer-events-none'}
      />

      {/* 游戏内叠加层 */}
      {isPlaying && (
        <div className="absolute inset-0 z-[30] pointer-events-none">

          {/* TAB 提示 — 左下角，不遮状态栏 */}
          <button
            onClick={() => setShowSidePanel(p => !p)}
            className="pointer-events-auto absolute bottom-4 left-3 font-mono text-xs text-crt-green/40 hover:text-crt-green/70 transition-colors"
          >
            [TAB] {lang === 'zh' ? '菜单' : 'MENU'}
          </button>

          <button
            onClick={() => setShowHelpPanel(true)}
            className="pointer-events-auto absolute bottom-4 left-24 font-mono text-xs text-crt-green/40 hover:text-crt-green/70 transition-colors"
          >
            [H] {lang === 'zh' ? '帮助' : 'HELP'}
          </button>

          {/* 交易进行中提示 — 右下角 */}
          {pendingTx && (
            <div className="absolute bottom-4 right-3 text-[11px] font-mono text-crt-green/70 animate-pulse text-right bg-black/70 px-3 py-1 border border-crt-green/20">
              <div>{pendingTx.label}</div>
              <div className="text-crt-green/40">{pendingTx.hash.slice(0, 12)}...</div>
            </div>
          )}
        </div>
      )}

      {/* TAB 侧边栏 */}
      {showSidePanel && (
        <div className="absolute inset-0 z-[40]" onClick={() => setShowSidePanel(false)}>
          <div
            className="absolute left-0 top-0 h-full w-64 bg-black/97 border-r border-crt-green/30 font-mono flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-crt-green/20">
              <p className="text-crt-green/40 text-[10px] tracking-widest mb-1">// SYSTEM PANEL</p>
              <p className="text-crt-green/80 text-xs">
                {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : lang === 'zh' ? '未连接' : 'NOT CONNECTED'}
              </p>
            </div>

            <div className="px-5 py-4 border-b border-crt-green/20 text-xs">
              <p className="text-crt-green/40 text-[10px] tracking-widest mb-2">// ACTIVE LOBSTER</p>
              {activeSummary ? (
                <div className="space-y-1 text-crt-green/70">
                  <p className="text-crt-green">NFA #{activeSummary.tokenId} · {getLobsterName(activeSummary.tokenId)}</p>
                  <p>Lv.{activeSummary.level} · {getRarityName(activeSummary.rarity, lang === 'zh')}</p>
                  <p>{getShelterName(activeSummary.shelter)}</p>
                  <p>CLW {activeSummary.clwBalance.toFixed(0)} · {activeSummary.active ? (lang === 'zh' ? '激活' : 'Active') : (lang === 'zh' ? '休眠' : 'Dormant')}</p>
                </div>
              ) : (
                <p className="text-crt-green/30">{lang === 'zh' ? '未选择龙虾' : 'No active lobster'}</p>
              )}
            </div>

            {/* NFA 切换 */}
            <div className="px-5 py-4 flex-1 overflow-y-auto">
              <p className="text-crt-green/50 text-[10px] tracking-widest mb-3">// SWITCH NFA</p>
              {nfaList.length === 0 && (
                <p className="text-crt-green/30 text-xs">无可用 NFA</p>
              )}
              {nfaList.map(id => (
                <button
                  key={id}
                  onClick={() => { void selectAndEnter(id); setShowSidePanel(false); }}
                  className="w-full text-left px-3 py-2 mb-2 border font-mono text-sm transition-colors
                    border-crt-green/20 text-crt-green/70 hover:border-crt-green/60 hover:text-crt-green
                    hover:bg-crt-green/5"
                >
                  <div>{id === activeNfaIdRef.current ? '▶ ' : '  '}NFA #{id}</div>
                  {nfaSummaries[id] && (
                    <div className="mt-1 text-[11px] text-crt-green/40">
                      Lv.{nfaSummaries[id].level} · {getRarityName(nfaSummaries[id].rarity, lang === 'zh')} · CLW {nfaSummaries[id].clwBalance.toFixed(0)}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* 底部操作 */}
            <div className="px-5 py-4 border-t border-crt-green/20 space-y-2">
              <button
                onClick={() => { setShowSidePanel(false); router.push('/nfa'); }}
                className="w-full soft-key py-2 text-xs"
              >
                {lang === 'zh' ? '[ NFA 详情 ]' : '[ NFA DETAIL ]'}
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full soft-key py-2 text-xs"
              >
                {lang === 'zh' ? '[ ← 返回首页 ]' : '[ ← HOME ]'}
              </button>
            </div>
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
              <p>{lang === 'zh' ? '点击地面 / 点按屏幕：移动到目标点' : 'Tap/click ground: move to point'}</p>
              <p>{lang === 'zh' ? 'SPACE：靠近装置后交互' : 'SPACE: interact near terminals'}</p>
              <p>{lang === 'zh' ? 'TAB：打开系统菜单' : 'TAB: open system menu'}</p>
              <p>{lang === 'zh' ? 'ESC：关闭面板 / 返回' : 'ESC: close panel / back'}</p>
            </div>

            <div className="border-t border-crt-green/15 pt-3 space-y-2">
              <p className="term-bright">{lang === 'zh' ? '合约功能入口' : 'Onchain Functions'}</p>
              <p>{lang === 'zh' ? '任务终端：生成 3 个任务并链上提交' : 'Task terminal: generate three tasks and submit onchain'}</p>
              <p>{lang === 'zh' ? '竞技擂台：创建、加入、揭示、结算、取消' : 'Arena: create, join, reveal, settle, cancel'}</p>
              <p>{lang === 'zh' ? '交易墙：固定价、拍卖、互换、购买、出价、取消、结算' : 'Market wall: fixed price, auction, swap, buy, bid, cancel, settle'}</p>
              <p>{lang === 'zh' ? '隧道传送：切换避难所' : 'Portal: switch shelters'}</p>
              <p>{lang === 'zh' ? '意识唤醒舱：进入 OpenClaw 入口' : 'Awakening pod: open OpenClaw entry'}</p>
            </div>
          </div>
        </div>
      )}

      {/* 大厅 UI — 在 CRT 终端页面内，selecting/booting 等状态显示 */}
      {!isPlaying && (
        <main className="h-full min-h-0 flex flex-col items-center justify-center px-2 sm:px-4 py-3 sm:py-8 overflow-y-auto">
          <div className="w-full max-w-3xl border border-crt-green/30 bg-black/80 px-4 sm:px-8 py-5 sm:py-8 font-mono shadow-[0_0_40px_rgba(57,255,20,0.06)] overflow-y-auto max-h-full">

            <div className="flex items-center justify-between mb-6">
              <p className="text-crt-green/40 text-xs tracking-widest">// SHELTER ACCESS TERMINAL</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
                  className="soft-key px-3 py-1 text-xs"
                  title={lang === 'zh' ? 'Switch to English' : '切换到中文'}
                >
                  {lang === 'zh' ? 'EN' : '中'}
                </button>
                <Link href="/" className="text-xs font-mono text-crt-green/40 hover:text-crt-green/80 transition-colors">
                  ← {lang === 'zh' ? '返回首页' : 'HOME'}
                </Link>
              </div>
            </div>

            {/* 钱包连接 + 同步 */}
            {(status === 'ready' || status === 'connected' || status === 'booting') && (
              <>
                <div className="text-sm text-crt-green/60 mb-5 min-h-5">
                  {isConnected && address
                    ? `${lang === 'zh' ? '已连接' : 'Connected'}: ${address.slice(0, 6)}...${address.slice(-4)}`
                    : (lang === 'zh' ? '请选择并连接钱包' : 'Select and connect a wallet')}
                </div>

                {!isConnected && (
                  <div className="grid gap-3 sm:grid-cols-2 mb-5">
                    {walletOptions.map((connector) => (
                      <button
                        key={connector.id}
                        onClick={() => {
                          setSelectedConnectorId(connector.id);
                          connect({ connector });
                        }}
                        className={`soft-key py-3 text-xs sm:text-sm ${selectedConnectorId === connector.id ? 'text-white' : ''}`}
                      >
                        {connector.name === 'Injected' ? '浏览器钱包 (MetaMask 等)' : connector.name}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => void startGameBoot()}
                  disabled={!isConnected || status === 'booting'}
                  className="soft-key w-full py-3 sm:py-4 text-sm sm:text-base mb-5 disabled:opacity-40 disabled:cursor-not-allowed"
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
                {status === 'booting' && (
                  <p className="text-sm text-crt-green/70 mb-6 animate-pulse">
                    {lang === 'zh' ? '正在获取链上数据...' : 'Fetching onchain data...'}
                  </p>
                )}

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
                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                  {nfaList.map((id) => (
                    <button
                      key={id}
                      onClick={() => selectAndEnter(id)}
                      className="min-w-0 rounded border border-crt-green/20 bg-black/70 px-4 sm:px-5 py-3 sm:py-4 text-left transition-all hover:border-crt-green/60 hover:bg-crt-green/5 hover:shadow-[0_0_18px_rgba(57,255,20,0.08)]"
                    >
                      <div className="text-base sm:text-lg text-crt-green mb-1 break-words">NFA #{id}</div>
                      <div className="text-xs text-crt-green/50 mb-2 break-words">{getLobsterName(id)}</div>
                      {nfaSummaries[id] ? (
                        (() => {
                          const summary = nfaSummaries[id];
                          const traits = [
                            { label: lang === 'zh' ? '勇气' : 'Courage', value: summary.courage },
                            { label: lang === 'zh' ? '智慧' : 'Wisdom', value: summary.wisdom },
                            { label: lang === 'zh' ? '社交' : 'Social', value: summary.social },
                            { label: lang === 'zh' ? '创造' : 'Create', value: summary.create },
                            { label: lang === 'zh' ? '毅力' : 'Grit', value: summary.grit },
                          ].sort((a, b) => b.value - a.value);

                          return (
                            <div className="space-y-1 text-xs sm:text-sm text-crt-green/70 break-words">
                              <div>Lv.{summary.level} · {getRarityName(summary.rarity, lang === 'zh')}</div>
                              <div>{getShelterName(summary.shelter)}</div>
                              <div>CLW {summary.clwBalance.toFixed(0)} · {summary.active ? (lang === 'zh' ? '激活' : 'Active') : (lang === 'zh' ? '休眠' : 'Dormant')}</div>
                              <div>{lang === 'zh' ? '主性格' : 'Dominant'}: {traits[0].label} {traits[0].value}</div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="text-sm text-crt-green/40">{lang === 'zh' ? '读取链上属性中...' : 'Loading onchain traits...'}</div>
                      )}
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

            <div className="mt-6 border-t border-crt-green/15 pt-4 text-xs text-crt-green/60 space-y-2">
              <p className="term-bright">{lang === 'zh' ? '操作说明' : 'HOW TO PLAY'}</p>
              <p>1. {lang === 'zh' ? '连接钱包后点击进入游戏' : 'Connect wallet, then enter game'}</p>
              <p>2. {lang === 'zh' ? '选一只龙虾进入避难所' : 'Choose a lobster to enter shelter'}</p>
              <p>3. {lang === 'zh' ? 'WASD/方向键或点击地面移动' : 'Move with WASD/arrows or tap the ground'}</p>
              <p>4. {lang === 'zh' ? '靠近装置后按 SPACE 或直接点击装置交互' : 'Approach terminals, press SPACE or tap them'}</p>
              <p>5. {lang === 'zh' ? '所有合约功能都在游戏内终端面板完成' : 'All contract actions run inside in-game terminal panels'}</p>
            </div>
          </div>
        </main>
      )}

      {/* OpenClaw 弹窗 */}
      {showOpenClaw && (
        <div className="absolute inset-0 flex items-center justify-center z-[50] bg-black/80 p-4">
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
    </div>
  );
}
