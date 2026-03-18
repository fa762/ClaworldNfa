'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { parseEther, zeroHash, type Address } from 'viem';
import Link from 'next/link';
import { TerminalBox } from '@/components/terminal/TerminalBox';
import { getBscScanTxUrl } from '@/contracts/addresses';
import { getRarityName, getRarityClass, getRarityStars } from '@/lib/rarity';
import { getShelterName } from '@/lib/shelter';
import {
  useMintingActive,
  useMintedCount,
  useRarityMinted,
  useCommitment,
  useCommitMint,
  useRevealMint,
  useRefund,
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
const REVEAL_DELAY = 60; // seconds
const REVEAL_WINDOW = 86400; // 24 hours

type Phase = 'select' | 'waiting' | 'ready' | 'expired' | 'success';

export function MintPanel() {
  const { address, isConnected } = useAccount();
  const [selectedRarity, setSelectedRarity] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [revealedNfaId, setRevealedNfaId] = useState<string | null>(null);
  const [revealedRarity, setRevealedRarity] = useState<number | null>(null);
  const [revealedShelter, setRevealedShelter] = useState<number | null>(null);

  // Read hooks
  const { data: mintingActive } = useMintingActive();
  const { data: mintedCount } = useMintedCount();
  const { data: rarityMinted } = useRarityMinted();
  const { data: commitment } = useCommitment(address);

  // Write hooks
  const commitMint = useCommitMint();
  const revealMint = useRevealMint();
  const refundHook = useRefund();

  // Parse commitment data: [hash, value, timestamp, revealed]
  const commitHash = commitment?.[0] as `0x${string}` | undefined;
  const commitTimestamp = commitment?.[2] ? Number(commitment[2]) : 0;
  const commitRevealed = commitment?.[3] as boolean | undefined;
  const hasActiveCommit = commitHash && commitHash !== zeroHash && !commitRevealed;

  // Determine current phase
  const phase = useMemo<Phase>(() => {
    if (revealedNfaId) return 'success';
    if (!hasActiveCommit) return 'select';
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - commitTimestamp;
    if (elapsed < REVEAL_DELAY) return 'waiting';
    if (elapsed < REVEAL_WINDOW) return 'ready';
    return 'expired';
  }, [hasActiveCommit, commitTimestamp, revealedNfaId, countdown]); // countdown drives re-eval

  // Timer for countdown
  useEffect(() => {
    if (!hasActiveCommit) return;
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - commitTimestamp;
      if (elapsed < REVEAL_DELAY) {
        setCountdown(REVEAL_DELAY - elapsed);
      } else if (elapsed < REVEAL_WINDOW) {
        setCountdown(REVEAL_WINDOW - elapsed);
      } else {
        setCountdown(0);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [hasActiveCommit, commitTimestamp]);

  // Handle commit
  function handleCommit() {
    if (!address) return;
    const salt = generateSalt();
    saveSalt(address, salt, selectedRarity);
    const hash = computeCommitHash(selectedRarity, salt, address);
    const price = parseEther(RARITY_PRICES[selectedRarity]);
    commitMint.commitMint(hash, price);
  }

  // Handle reveal
  function handleReveal() {
    if (!address) return;
    const saved = loadSalt(address);
    if (!saved) return;
    revealMint.revealMint(saved.rarity, saved.salt);
  }

  // Handle refund
  function handleRefund() {
    refundHook.refund();
  }

  // Watch for successful reveal
  useEffect(() => {
    if (revealMint.isSuccess && address) {
      clearSalt(address);
      // We can't easily parse events from wagmi v2 receipt,
      // so show a generic success and link to NFA collection
      setRevealedNfaId('new');
      const saved = loadSalt(address);
      if (saved) setRevealedRarity(saved.rarity);
    }
  }, [revealMint.isSuccess, address]);

  // Watch for successful refund
  useEffect(() => {
    if (refundHook.isSuccess && address) {
      clearSalt(address);
    }
  }, [refundHook.isSuccess, address]);

  // Reset to mint another
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

  return (
    <div className="space-y-4">
      {/* Progress */}
      <TerminalBox title="铸造进度">
        <div className="space-y-2">
          {/* Overall progress */}
          <div className="flex items-center gap-2 text-sm">
            <span className="term-dim">总进度:</span>
            <span className="term-bright">{totalMinted}</span>
            <span className="term-dim">/ {TOTAL_GENESIS}</span>
          </div>
          <div className="text-xs">
            {(() => {
              const w = 30;
              const filled = Math.round((totalMinted / TOTAL_GENESIS) * w);
              return (
                <span>
                  <span className="text-crt-green">{'█'.repeat(filled)}</span>
                  <span className="term-darkest">{'░'.repeat(w - filled)}</span>
                </span>
              );
            })()}
          </div>

          {/* Per-rarity */}
          <div className="term-line my-2" />
          <div className="space-y-1 text-xs">
            {[0, 1, 2, 3, 4].map((r) => {
              const minted = rarityMinted ? Number(rarityMinted[r]) : 0;
              const cap = RARITY_CAPS[r];
              const soldOut = minted >= cap;
              return (
                <div key={r} className="flex items-center gap-2">
                  <span className={`w-12 text-right ${getRarityClass(r)}`}>
                    {getRarityName(r, true)}
                  </span>
                  <span className="term-dim">{minted}/{cap}</span>
                  <span className="term-dim">({RARITY_PRICES[r]} BNB)</span>
                  {soldOut && <span className="term-danger">[SOLD OUT]</span>}
                </div>
              );
            })}
          </div>
        </div>
      </TerminalBox>

      {/* Mint action */}
      <TerminalBox title="创世铸造">
        {!isConnected ? (
          <div className="term-dim text-sm py-4 text-center">
            连接钱包以进行铸造
          </div>
        ) : mintingActive === false ? (
          <div className="term-warn text-sm py-4 text-center">
            [!] 铸造尚未开始
          </div>
        ) : (
          <div className="space-y-3">
            {/* Phase: SELECT */}
            {phase === 'select' && (
              <>
                <div className="text-xs term-dim">&gt; 选择稀有度:</div>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4].map((r) => {
                    const minted = rarityMinted ? Number(rarityMinted[r]) : 0;
                    const soldOut = minted >= RARITY_CAPS[r];
                    const isSelected = selectedRarity === r;
                    return (
                      <button
                        key={r}
                        onClick={() => !soldOut && setSelectedRarity(r)}
                        disabled={soldOut}
                        className={
                          soldOut
                            ? 'term-darkest cursor-not-allowed text-xs'
                            : isSelected
                            ? `${getRarityClass(r)} glow text-xs`
                            : 'term-dim hover:text-crt-green text-xs'
                        }
                      >
                        [{isSelected ? '> ' : ''}{getRarityName(r, true)} {RARITY_PRICES[r]} BNB{getRarityStars(r) ? ` ${getRarityStars(r)}` : ''}]
                      </button>
                    );
                  })}
                </div>

                {/* Selected rarity info */}
                <div className="text-xs space-y-1">
                  <div className="term-dim">
                    &gt; 价格: <span className="term-bright">{RARITY_PRICES[selectedRarity]} BNB</span>
                  </div>
                  <div className="term-dim">
                    &gt; CLW 空投: <span className="term-bright">{RARITY_AIRDROPS[selectedRarity]} CLW</span>
                  </div>
                </div>

                <button
                  onClick={handleCommit}
                  disabled={commitMint.isPending || commitMint.isConfirming}
                  className="term-btn term-btn-primary text-sm w-full"
                >
                  [{commitMint.isPending ? '签名...' : commitMint.isConfirming ? '确认中...' : `确认铸造 — ${RARITY_PRICES[selectedRarity]} BNB`}]
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
              <div className="text-center space-y-3 py-4">
                <div className="term-warn text-sm">等待揭示窗口...</div>
                <div className="term-bright text-2xl glow-strong">{formatTime(countdown)}</div>
                <div className="term-dim text-xs">
                  提交已记录，揭示窗口将在倒计时结束后开放
                </div>
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
              </div>
            )}

            {/* Phase: EXPIRED */}
            {phase === 'expired' && (
              <div className="space-y-3">
                <div className="term-danger text-sm">[!] 揭示窗口已过期</div>
                <div className="term-dim text-xs">
                  超过 24 小时未揭示。你可以申请退回已支付的 BNB。
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
              <div className="text-center space-y-3 py-4">
                <div className="term-bright text-lg glow-strong">铸造成功!</div>
                <div className="term-dim text-sm">
                  你的创世龙虾 NFA 已铸造
                </div>

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
      </TerminalBox>

      {/* Info box */}
      <TerminalBox title="铸造说明">
        <div className="space-y-1 text-xs term-dim">
          <div>&gt; 铸造采用 commit-reveal 两步机制，防止抢跑</div>
          <div>&gt; 第一步: 选择稀有度并提交 (commit)，支付 BNB</div>
          <div>&gt; 第二步: 等待 1 分钟后揭示 (reveal)，获得随机属性的龙虾</div>
          <div>&gt; 如果 24 小时内未揭示，可以申请全额退款</div>
          <div className="term-warn">&gt; [!] 请勿在 commit 后清除浏览器数据，否则无法揭示</div>
        </div>
      </TerminalBox>
    </div>
  );
}
