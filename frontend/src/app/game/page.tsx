'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { eventBus } from '@/game/EventBus';
import { loadPlayerNFAs, loadNFAState } from '@/game/chain/wallet';
import { useI18n } from '@/lib/i18n';
import Link from 'next/link';
import type { Address } from 'viem';

/**
 * /game — Claw World 2D RPG 游戏页
 * 全屏 Phaser 画布 + React 覆盖层
 */
export default function GamePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<unknown>(null);  // Phaser.Game (避免 SSR 类型)
  const { address, isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const { lang } = useI18n();
  const [status, setStatus] = useState('loading');
  const [nfaList, setNfaList] = useState<number[]>([]);
  const [mounted, setMounted] = useState(false);

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

      {/* 覆盖层 UI */}
      {status !== 'playing' && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="pointer-events-auto text-center">

            {/* 未连接钱包 */}
            {(!isConnected && status === 'ready') && (
              <div>
                <button
                  onClick={() => open()}
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
