'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { eventBus } from '@/game/EventBus';
import { loadPlayerNFAs, loadNFAState } from '@/game/chain/wallet';
import { useI18n } from '@/lib/i18n';
import type { Address } from 'viem';

/**
 * /game — Claw World 2D RPG 游戏页面
 * Next.js 壳，动态加载 Phaser（不支持 SSR）
 */
export default function GamePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const { address, isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const { t, lang } = useI18n();
  const [status, setStatus] = useState('loading');
  const [nfaList, setNfaList] = useState<number[]>([]);
  const [selectedNfa, setSelectedNfa] = useState<number | null>(null);

  // 初始化 Phaser（仅客户端）
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    // 动态导入 Phaser（不能 SSR）
    import('@/game/main').then(({ createGame }) => {
      if (containerRef.current && !gameRef.current) {
        gameRef.current = createGame(containerRef.current);
        setStatus('ready');
      }
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // 钱包连接后加载 NFA
  useEffect(() => {
    if (!isConnected || !address) return;

    eventBus.emit('wallet:connected', { address });

    loadPlayerNFAs(address as Address).then(ids => {
      setNfaList(ids);
      if (ids.length === 1) {
        // 只有一只龙虾，直接进入
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
    setSelectedNfa(nfaId);
    setStatus('loading-nfa');
    try {
      const state = await loadNFAState(nfaId);
      eventBus.emit('nfa:loaded', { nfaId, shelter: state.shelter });
      eventBus.emit('nfa:stats', { clw: state.clwBalance.toFixed(0), level: state.level });
      setStatus('playing');
    } catch (err) {
      console.error('Failed to load NFA state:', err);
      setStatus('error');
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* 游戏画布 */}
      <div
        ref={containerRef}
        className="flex-1 relative"
        style={{ minHeight: 0 }}
      />

      {/* 覆盖层 UI（根据状态显示） */}
      {status !== 'playing' && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          {/* 未连接钱包 */}
          {(!isConnected && status === 'ready') && (
            <div className="text-center">
              <button
                onClick={() => open()}
                className="soft-key text-sm px-6 py-3 font-mono"
              >
                {lang === 'zh' ? '[ 连接钱包进入游戏 ]' : '[ CONNECT WALLET TO PLAY ]'}
              </button>
              <p className="text-[10px] font-mono text-crt-green/40 mt-3">
                MetaMask / WalletConnect
              </p>
            </div>
          )}

          {/* 没有 NFA */}
          {status === 'no-nfa' && (
            <div className="text-center font-mono">
              <p className="text-crt-green text-sm mb-3">
                {lang === 'zh' ? '你还没有龙虾 NFA' : 'You don\'t have any lobster NFA'}
              </p>
              <a href="/mint" className="soft-key text-xs px-4 py-2">
                {lang === 'zh' ? '[ 去铸造 ]' : '[ MINT NOW ]'}
              </a>
            </div>
          )}

          {/* 多只 NFA，选择 */}
          {status === 'select-nfa' && (
            <div className="text-center font-mono">
              <p className="text-crt-green text-sm mb-4">
                {lang === 'zh' ? '选择你的龙虾' : 'Choose your lobster'}
              </p>
              <div className="flex gap-3 flex-wrap justify-center">
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
              {lang === 'zh' ? '加载中...' : 'LOADING...'}
            </p>
          )}

          {/* 错误 */}
          {status === 'error' && (
            <div className="text-center font-mono">
              <p className="text-red-400 text-sm mb-3">
                {lang === 'zh' ? '加载失败' : 'LOAD FAILED'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="soft-key text-xs px-4 py-2"
              >
                {lang === 'zh' ? '[ 重试 ]' : '[ RETRY ]'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
