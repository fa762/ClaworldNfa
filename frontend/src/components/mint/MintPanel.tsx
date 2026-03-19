'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { simulateContract } from '@wagmi/core';
import { parseEther, zeroHash } from 'viem';
import Link from 'next/link';
import { config } from '@/components/wallet/WalletProvider';
import { getBscScanTxUrl } from '@/contracts/addresses';
import { getRarityName, getRarityClass, getRarityStars } from '@/lib/rarity';
import { nativeSymbol } from '@/lib/format';
import {
  useMintingActive,
  useMintedCount,
  useRarityMinted,
  useCommitment,
  useCommitMint,
  useRevealMint,
  useRefund,
  vaultContract,
  RARITY_PRICES,
  RARITY_CAPS,
  RARITY_AIRDROPS,
  generateSalt,
  computeCommitHash,
  saveSalt,
  loadSalt,
  clearSalt,
} from '@/contracts/hooks/useGenesisVault';

const TOTAL_GENESIS = 888;
const REVEAL_DELAY = 60;
const REVEAL_WINDOW = 86400;

type Phase = 'select' | 'waiting' | 'ready' | 'expired' | 'success';

export function MintPanel() {
  const { address, isConnected } = useAccount();
  const [selectedRarity, setSelectedRarity] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [revealedNfaId, setRevealedNfaId] = useState<string | null>(null);
  const [revealedRarity, setRevealedRarity] = useState<number | null>(null);
  const [revealedShelter, setRevealedShelter] = useState<number | null>(null);

  const { data: mintingActive } = useMintingActive();
  const { data: mintedCount } = useMintedCount();
  const { data: rarityMinted } = useRarityMinted();
  const { data: commitment } = useCommitment(address);

  const commitMint = useCommitMint();
  const revealMint = useRevealMint();
  const refundHook = useRefund();

  const commitHash = commitment?.[0] as `0x${string}` | undefined;
  const commitTimestamp = commitment?.[2] ? Number(commitment[2]) : 0;
  const commitRevealed = commitment?.[3] as boolean | undefined;
  const hasActiveCommit = commitHash && commitHash !== zeroHash && !commitRevealed;

  const phase = useMemo<Phase>(() => {
    if (revealedNfaId) return 'success';
    if (!hasActiveCommit) return 'select';
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - commitTimestamp;
    if (elapsed < REVEAL_DELAY) return 'waiting';
    if (elapsed < REVEAL_WINDOW) return 'ready';
    return 'expired';
  }, [hasActiveCommit, commitTimestamp, revealedNfaId, countdown]);

  useEffect(() => {
    if (!hasActiveCommit) return;
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - commitTimestamp;
      if (elapsed < REVEAL_DELAY) setCountdown(REVEAL_DELAY - elapsed);
      else if (elapsed < REVEAL_WINDOW) setCountdown(REVEAL_WINDOW - elapsed);
      else setCountdown(0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [hasActiveCommit, commitTimestamp]);

  function handleCommit() {
    if (!address) return;
    const salt = generateSalt();
    saveSalt(address, salt, selectedRarity);
    const hash = computeCommitHash(selectedRarity, salt, address);
    const price = parseEther(RARITY_PRICES[selectedRarity]);
    commitMint.commitMint(hash, price);
  }

  const [debugError, setDebugError] = useState<string | null>(null);

  async function handleReveal() {
    if (!address) return;
    const saved = loadSalt(address);
    if (!saved) {
      setDebugError('未找到本地 salt 数据');
      return;
    }
    setDebugError(null);
    try {
      await simulateContract(config, {
        ...vaultContract,
        functionName: 'reveal',
        args: [saved.rarity, saved.salt],
        account: address,
      });
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || String(err);
      setDebugError(msg);
    }
    revealMint.revealMint(saved.rarity, saved.salt);
  }

  function handleRefund() {
    refundHook.refund();
  }

  useEffect(() => {
    if (revealMint.isSuccess && address) {
      clearSalt(address);
      setRevealedNfaId('new');
      const saved = loadSalt(address);
      if (saved) setRevealedRarity(saved.rarity);
    }
  }, [revealMint.isSuccess, address]);

  useEffect(() => {
    if (refundHook.isSuccess && address) {
      clearSalt(address);
    }
  }, [refundHook.isSuccess, address]);

  function handleReset() {
    setRevealedNfaId(null);
    setRevealedRarity(null);
    setRevealedShelter(null);
    commitMint.reset();
    revealMint.reset();
    refundHook.reset();
  }

  const savedSalt = address ? loadSalt(address) : null;
  const totalMinted = mintedCount !== undefined ? Number(mintedCount) : 0;

  function formatTime(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  /* ─── Progress bar helper ─── */
  function ProgressBar({ value, max, width = 20 }: { value: number; max: number; width?: number }) {
    const filled = Math.round((value / max) * width);
    return (
      <span className="text-xs">
        <span className="text-crt-green">{'█'.repeat(filled)}</span>
        <span className="term-darkest">{'░'.repeat(width - filled)}</span>
      </span>
    );
  }

  return (
    <div className="pipboy-split">
      {/* ═══ LEFT: Stats & Info ═══ */}
      <div className="pipboy-split-sidebar" style={{ width: 220 }}>
        {/* Progress */}
        <div className="px-3 py-2">
          <div className="term-bright text-xs glow mb-2">铸造进度</div>
          <div className="flex items-center gap-2 text-xs mb-1">
            <span className="term-dim">总量</span>
            <span className="term-bright">{totalMinted}</span>
            <span className="term-dim">/ {TOTAL_GENESIS}</span>
          </div>
          <ProgressBar value={totalMinted} max={TOTAL_GENESIS} />

          <div className="term-line my-2" />

          {[0, 1, 2, 3, 4].map((r) => {
            const minted = rarityMinted ? Number(rarityMinted[r]) : 0;
            const cap = RARITY_CAPS[r];
            const soldOut = minted >= cap;
            return (
              <div key={r} className="flex items-center gap-1 text-xs leading-5">
                <span className={`w-10 text-right ${getRarityClass(r)}`}>
                  {getRarityName(r, true)}
                </span>
                <span className="term-dim flex-1">{minted}/{cap}</span>
                <span className="term-dim">{RARITY_PRICES[r]}</span>
                {soldOut && <span className="term-danger">!</span>}
              </div>
            );
          })}
        </div>

        <div className="term-line" />

        {/* Instructions */}
        <div className="px-3 py-2 space-y-1 text-xs term-dim">
          <div className="term-bright text-xs glow mb-1">铸造说明</div>
          <div>&gt; commit-reveal 两步机制</div>
          <div>&gt; 1. 选择稀有度 → 提交</div>
          <div>&gt; 2. 等 1 分钟 → 揭示</div>
          <div>&gt; 24h 未揭示可退款</div>
          <div className="term-warn">&gt; [!] 勿清浏览器数据</div>
        </div>
      </div>

      {/* ═══ RIGHT: Mint Action ═══ */}
      <div className="pipboy-split-content flex flex-col">
        <div className="term-bright text-sm glow mb-3">创世铸造 — Genesis Mint</div>

        {!isConnected ? (
          <div className="term-dim text-sm py-8 text-center">
            连接钱包以进行铸造
          </div>
        ) : mintingActive === false ? (
          <div className="term-warn text-sm py-8 text-center">
            [!] 铸造尚未开始
          </div>
        ) : (
          <div className="space-y-3 flex-1">
            {/* Phase: SELECT */}
            {phase === 'select' && (
              <>
                <div className="text-xs term-dim">&gt; 选择稀有度:</div>
                <div className="space-y-1">
                  {[0, 1, 2, 3, 4].map((r) => {
                    const minted = rarityMinted ? Number(rarityMinted[r]) : 0;
                    const soldOut = minted >= RARITY_CAPS[r];
                    const isSelected = selectedRarity === r;
                    return (
                      <button
                        key={r}
                        onClick={() => !soldOut && setSelectedRarity(r)}
                        disabled={soldOut}
                        className={`block w-full text-left text-xs py-1 px-2 transition-colors ${
                          soldOut
                            ? 'term-darkest cursor-not-allowed line-through'
                            : isSelected
                            ? `${getRarityClass(r)} glow`
                            : 'term-dim hover:text-crt-green'
                        }`}
                        style={isSelected ? { background: 'rgba(51,255,102,0.08)' } : undefined}
                      >
                        {isSelected ? '> ' : '  '}
                        {getRarityName(r, true)}
                        {' '}{RARITY_PRICES[r]} {nativeSymbol}
                        {' '}· 空投 {RARITY_AIRDROPS[r]} CLW
                        {getRarityStars(r) ? ` ${getRarityStars(r)}` : ''}
                        {soldOut ? ' [SOLD OUT]' : ''}
                      </button>
                    );
                  })}
                </div>

                <div className="term-line my-2" />

                <div className="text-xs space-y-1">
                  <div className="term-dim">
                    &gt; 已选: <span className={getRarityClass(selectedRarity)}>{getRarityName(selectedRarity, true)}</span>
                  </div>
                  <div className="term-dim">
                    &gt; 费用: <span className="term-bright">{RARITY_PRICES[selectedRarity]} {nativeSymbol}</span>
                    {' '}· 空投: <span className="term-bright">{RARITY_AIRDROPS[selectedRarity]} CLW</span>
                  </div>
                </div>

                <button
                  onClick={handleCommit}
                  disabled={commitMint.isPending || commitMint.isConfirming}
                  className="term-btn term-btn-primary text-sm w-full"
                >
                  [{commitMint.isPending ? '签名...' : commitMint.isConfirming ? '确认中...' : `确认铸造 — ${RARITY_PRICES[selectedRarity]} ${nativeSymbol}`}]
                </button>

                {commitMint.hash && (
                  <a href={getBscScanTxUrl(commitMint.hash)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
                    [查看交易 →]
                  </a>
                )}
                {commitMint.error && (
                  <div className="term-danger text-xs">
                    [!] {(commitMint.error as any)?.shortMessage || commitMint.error.message}
                  </div>
                )}
              </>
            )}

            {/* Phase: WAITING */}
            {phase === 'waiting' && (
              <div className="text-center space-y-3 py-6">
                <div className="term-warn text-sm">等待揭示窗口...</div>
                <div className="term-bright text-2xl glow-strong">{formatTime(countdown)}</div>
                <div className="term-dim text-xs">提交已记录，揭示窗口将在倒计时结束后开放</div>
              </div>
            )}

            {/* Phase: READY */}
            {phase === 'ready' && (
              <div className="space-y-3">
                <div className="text-sm term-bright glow">揭示窗口已开放!</div>
                <div className="term-dim text-xs">
                  剩余揭示时间: <span className="term-warn">{formatTime(countdown)}</span>
                </div>
                {!savedSalt && (
                  <div className="term-danger text-xs">
                    [!] 未找到本地 salt 数据。如果您清除了浏览器数据，需要等待 24 小时后申请退款。
                  </div>
                )}
                <button
                  onClick={handleReveal}
                  disabled={revealMint.isPending || revealMint.isConfirming || !savedSalt}
                  className="term-btn term-btn-primary text-sm w-full"
                >
                  [{revealMint.isPending ? '签名...' : revealMint.isConfirming ? '确认中...' : '揭示你的龙虾 NFA'}]
                </button>
                {revealMint.hash && (
                  <a href={getBscScanTxUrl(revealMint.hash)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
                    [查看交易 →]
                  </a>
                )}
                {revealMint.error && (
                  <div className="term-danger text-xs">
                    [!] {(revealMint.error as any)?.shortMessage || revealMint.error.message}
                  </div>
                )}
                {debugError && (
                  <div className="term-danger text-xs">[DEBUG] {debugError}</div>
                )}
              </div>
            )}

            {/* Phase: EXPIRED */}
            {phase === 'expired' && (
              <div className="space-y-3">
                <div className="term-danger text-sm">[!] 揭示窗口已过期</div>
                <div className="term-dim text-xs">
                  超过 24 小时未揭示。你可以申请退回已支付的 {nativeSymbol}。
                </div>
                <button
                  onClick={handleRefund}
                  disabled={refundHook.isPending || refundHook.isConfirming}
                  className="term-btn term-btn-primary text-sm w-full"
                >
                  [{refundHook.isPending ? '签名...' : refundHook.isConfirming ? '确认中...' : '申请退款'}]
                </button>
                {refundHook.hash && (
                  <a href={getBscScanTxUrl(refundHook.hash)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
                    [查看交易 →]
                  </a>
                )}
                {refundHook.error && (
                  <div className="term-danger text-xs">
                    [!] {(refundHook.error as any)?.shortMessage || refundHook.error.message}
                  </div>
                )}
              </div>
            )}

            {/* Phase: SUCCESS */}
            {phase === 'success' && (
              <div className="text-center space-y-3 py-6">
                <div className="term-bright text-lg glow-strong">铸造成功!</div>
                <div className="term-dim text-sm">你的创世龙虾 NFA 已铸造</div>
                {revealMint.hash && (
                  <a href={getBscScanTxUrl(revealMint.hash)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
                    [查看铸造交易 →]
                  </a>
                )}
                <div className="flex justify-center gap-3 pt-2">
                  <Link href="/nfa" className="term-btn term-btn-primary text-sm">
                    [查看 NFA 合集]
                  </Link>
                  <button onClick={handleReset} className="term-btn text-sm">
                    [铸造另一个]
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
