'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { eventBus } from '@/game/EventBus';
import { loadPlayerNFAs, loadNFAState, loadMarketListings, loadOpenMatches } from '@/game/chain/wallet';
import {
  taskSubmitArgs,
  pkCreateArgs,
  pkJoinArgs,
  generateCommit,
  savePKSalt,
  marketListArgs,
  nfaApproveArgs,
} from '@/game/chain/contracts';
import { useI18n } from '@/lib/i18n';
import Link from 'next/link';
import type { Address } from 'viem';
import { formatEther } from 'viem';

/**
 * /game — Claw World 2D RPG 游戏页
 * 全屏 Phaser 画布 + React 覆盖层 + 链上事件桥接
 */
export default function GamePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<unknown>(null);
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { writeContractAsync } = useWriteContract();
  const { lang } = useI18n();
  const [status, setStatus] = useState('loading');
  const [nfaList, setNfaList] = useState<number[]>([]);
  const [mounted, setMounted] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  // 等待交易确认
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // 客户端挂载检测
  useEffect(() => setMounted(true), []);

  // 初始化 Phaser（仅客户端）
  useEffect(() => {
    if (!mounted || !containerRef.current || gameRef.current) return;

    import('@/game/main').then(({ createGame }) => {
      if (containerRef.current && !gameRef.current) {
        gameRef.current = createGame(containerRef.current);
        setStatus('ready');
      }
    }).catch(err => {
      console.error('Phaser init failed:', err);
      setStatus('error');
    });

    return () => {
      if (gameRef.current) {
        (gameRef.current as { destroy: (b: boolean) => void }).destroy(true);
        gameRef.current = null;
      }
    };
  }, [mounted]);

  // 钱包连接后加载 NFA
  useEffect(() => {
    if (!isConnected || !address) return;

    eventBus.emit('wallet:connected', { address });

    loadPlayerNFAs(address as Address).then(ids => {
      setNfaList(ids);
      if (ids.length === 1) {
        selectAndEnter(ids[0]);
      } else if (ids.length === 0) {
        setStatus('no-nfa');
      } else {
        setStatus('select-nfa');
      }
    }).catch(err => {
      console.error('Failed to load NFAs:', err);
      setStatus('error');
    });
  }, [isConnected, address]);

  const selectAndEnter = useCallback(async (nfaId: number) => {
    setStatus('loading-nfa');
    try {
      const state = await loadNFAState(nfaId);
      eventBus.emit('nfa:loaded', { nfaId, shelter: state.shelter });
      eventBus.emit('nfa:stats', { clw: state.clwBalance.toFixed(0), level: state.level });
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
      setStatus('playing');
    } catch (err) {
      console.error('Failed to load NFA state:', err);
      setStatus('error');
    }
  }, []);

  // ─── 链上写操作事件桥接 ───
  useEffect(() => {
    if (!mounted) return;

    // 任务提交
    const unsubTask = eventBus.on('task:submit', async (...args: unknown[]) => {
      const data = args[0] as { nfaId: number; taskType: number; xp: number; clw: number; matchScore: number };
      try {
        const txArgs = taskSubmitArgs(data.nfaId, data.taskType, data.xp, data.clw, data.matchScore);
        const hash = await writeContractAsync(txArgs);
        setTxHash(hash);
        eventBus.emit('task:result', { success: true, hash });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Transaction failed';
        console.error('Task submit failed:', err);
        eventBus.emit('task:result', { success: false, error: message });
      }
    });

    // PK 创建
    const unsubPKCreate = eventBus.on('pk:create', async (...args: unknown[]) => {
      const data = args[0] as { nfaId: number; strategy: number; stake: number };
      try {
        const { commitHash, salt } = generateCommit(data.strategy);
        const txArgs = pkCreateArgs(data.nfaId, BigInt(data.stake), commitHash);
        const hash = await writeContractAsync(txArgs);
        savePKSalt(0, data.strategy, salt);
        setTxHash(hash);
        eventBus.emit('pk:result', { success: true, hash, action: 'create' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Transaction failed';
        console.error('PK create failed:', err);
        eventBus.emit('pk:result', { success: false, error: message });
      }
    });

    // PK 加入
    const unsubPKJoin = eventBus.on('pk:join', async (...args: unknown[]) => {
      const data = args[0] as { nfaId: number; matchId: number; strategy: number };
      try {
        const { commitHash, salt } = generateCommit(data.strategy);
        const txArgs = pkJoinArgs(data.matchId, data.nfaId, commitHash);
        const hash = await writeContractAsync(txArgs);
        savePKSalt(data.matchId, data.strategy, salt);
        setTxHash(hash);
        eventBus.emit('pk:result', { success: true, hash, action: 'join' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Transaction failed';
        console.error('PK join failed:', err);
        eventBus.emit('pk:result', { success: false, error: message });
      }
    });

    // PK 搜索
    const unsubPKSearch = eventBus.on('pk:search', async () => {
      try {
        const matches = await loadOpenMatches();
        eventBus.emit('pk:matches', matches.map(m => ({
          matchId: m.matchId,
          nfaId: m.nfaA,
          stake: formatEther(m.stake),
        })));
      } catch (err) {
        console.error('PK search failed:', err);
        eventBus.emit('pk:matches', []);
      }
    });

    // 市场列表请求
    const unsubMarketList = eventBus.on('market:requestListings', async () => {
      try {
        const listings = await loadMarketListings();
        eventBus.emit('market:listings', listings.map(l => ({
          listingId: l.listingId,
          nfaId: l.nfaId,
          price: formatEther(l.price),
          seller: l.seller,
          type: l.listingType,
        })));
      } catch (err) {
        console.error('Market listings failed:', err);
        eventBus.emit('market:listings', []);
      }
    });

    // 市场购买
    const unsubMarketBuy = eventBus.on('market:buy', async (...args: unknown[]) => {
      const data = args[0] as { listingId: number; price: string };
      try {
        const priceWei = BigInt(Math.round(parseFloat(data.price) * 1e18));
        const hash = await writeContractAsync({
          address: (await import('@/contracts/addresses')).addresses.marketSkill as Address,
          abi: (await import('@/contracts/abis/MarketSkill')).MarketSkillABI,
          functionName: 'buyFixedPrice',
          args: [BigInt(data.listingId)],
          value: priceWei,
          gas: 300_000n,
        });
        setTxHash(hash);
        eventBus.emit('market:buyResult', { success: true, hash });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Transaction failed';
        console.error('Market buy failed:', err);
        eventBus.emit('market:buyResult', { success: false, error: message });
      }
    });

    // 市场挂售
    const unsubMarketSell = eventBus.on('market:list', async (...args: unknown[]) => {
      const data = args[0] as { nfaId: number; price: string };
      try {
        const priceWei = BigInt(Math.round(parseFloat(data.price) * 1e18));
        const approveArgs = nfaApproveArgs(data.nfaId);
        await writeContractAsync(approveArgs);
        const listTxArgs = marketListArgs(data.nfaId, priceWei);
        const hash = await writeContractAsync(listTxArgs);
        setTxHash(hash);
        eventBus.emit('market:listResult', { success: true, hash });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Transaction failed';
        console.error('Market list failed:', err);
        eventBus.emit('market:listResult', { success: false, error: message });
      }
    });

    return () => {
      unsubTask();
      unsubPKCreate();
      unsubPKJoin();
      unsubPKSearch();
      unsubMarketList();
      unsubMarketBuy();
      unsubMarketSell();
    };
  }, [mounted, writeContractAsync]);

  // 监听游戏内事件
  const [showOpenClaw, setShowOpenClaw] = useState(false);
  useEffect(() => {
    const unsub1 = eventBus.on('game:openclaw', () => setShowOpenClaw(true));
    return () => { unsub1(); };
  }, []);

  // SSR 阶段不渲染任何内容
  if (!mounted) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <p className="text-crt-green font-mono text-xs animate-pulse">INITIALIZING...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen bg-black">
      {/* Phaser 画布容器 */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* 返回官网按钮 */}
      <Link
        href="/"
        className="absolute top-2 left-2 z-30 text-[9px] font-mono text-crt-green/40 hover:text-crt-green/80 transition-colors"
      >
        ← TERMINAL
      </Link>

      {/* 交易状态提示 */}
      {txHash && !txConfirmed && (
        <div className="absolute top-2 right-2 z-30 text-[9px] font-mono text-crt-green/60 animate-pulse">
          TX PENDING...
        </div>
      )}

      {/* 覆盖层 UI */}
      {status !== 'playing' && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="pointer-events-auto text-center">

            {/* 未连接钱包 */}
            {(!isConnected && status === 'ready') && (
              <div>
                <button
                  onClick={() => {
                    const inj = connectors.find((c) => c.type === 'injected');
                    const wc = connectors.find((c) => c.name === 'WalletConnect');
                    const connector = (inj && (window as any).ethereum) ? inj : wc || connectors[0];
                    if (connector) connect({ connector });
                  }}
                  className="soft-key text-sm px-6 py-3 font-mono"
                >
                  {lang === 'zh' ? '[ 连接钱包进入游戏 ]' : '[ CONNECT WALLET TO PLAY ]'}
                </button>
                <p className="text-[10px] font-mono text-crt-green/40 mt-3">
                  MetaMask / WalletConnect
                </p>
                <Link href="/mint" className="block text-[10px] font-mono text-crt-green/30 mt-6 hover:text-crt-green/60">
                  {lang === 'zh' ? '还没有龙虾？去铸造 →' : 'No lobster? Mint one →'}
                </Link>
              </div>
            )}

            {/* 没有 NFA */}
            {status === 'no-nfa' && (
              <div className="font-mono">
                <p className="text-crt-green text-sm mb-4">
                  {lang === 'zh' ? '未检测到龙虾 NFA' : 'No lobster NFA detected'}
                </p>
                <Link href="/mint" className="soft-key text-xs px-6 py-2">
                  {lang === 'zh' ? '[ 去铸造 ]' : '[ MINT NOW ]'}
                </Link>
              </div>
            )}

            {/* 多只 NFA 选择 */}
            {status === 'select-nfa' && (
              <div className="font-mono">
                <p className="text-crt-green text-sm mb-4">
                  {lang === 'zh' ? '选择你的龙虾' : 'Choose your lobster'}
                </p>
                <div className="flex gap-3 flex-wrap justify-center max-w-sm">
                  {nfaList.map(id => (
                    <button
                      key={id}
                      onClick={() => selectAndEnter(id)}
                      className="soft-key text-xs px-4 py-2"
                    >
                      NFA #{id}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 加载中 */}
            {(status === 'loading' || status === 'loading-nfa') && (
              <p className="text-crt-green font-mono text-xs animate-pulse">
                {status === 'loading-nfa'
                  ? (lang === 'zh' ? '读取链上数据...' : 'READING CHAIN DATA...')
                  : (lang === 'zh' ? '初始化引擎...' : 'INITIALIZING ENGINE...')}
              </p>
            )}

            {/* 错误 */}
            {status === 'error' && (
              <div className="font-mono">
                <p className="text-red-400 text-sm mb-3">
                  {lang === 'zh' ? '加载失败' : 'LOAD FAILED'}
                </p>
                <button onClick={() => window.location.reload()} className="soft-key text-xs px-4 py-2">
                  {lang === 'zh' ? '[ 重试 ]' : '[ RETRY ]'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OpenClaw 意识唤醒弹窗 */}
      {showOpenClaw && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/80">
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
