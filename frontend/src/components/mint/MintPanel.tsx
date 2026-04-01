'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { simulateContract } from '@wagmi/core';
import { parseEther, zeroHash, isAddress, type Address } from 'viem';
import Link from 'next/link';
import { config } from '@/components/wallet/WalletProvider';
import { getBscScanTxUrl } from '@/contracts/addresses';
import { getRarityName, getRarityClass, getRarityStars } from '@/lib/rarity';
import { nativeSymbol } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import {
  useMintingActive,
  useMintedCount,
  useRarityMinted,
  useCommitment,
  useCommitMint,
  useRevealMint,
  useRefund,
  useVaultOwner,
  useOwnerMint,
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
import { useTotalSupply } from '@/contracts/hooks/useClawNFA';

const TOTAL_GENESIS = 888;
const REVEAL_DELAY = 60;
const REVEAL_WINDOW = 86400;

type Phase = 'select' | 'waiting' | 'ready' | 'expired' | 'success';

export function MintPanel() {
  const { address, isConnected } = useAccount();
  const { lang, t } = useI18n();
  const isCN = lang === 'zh';
  const [selectedRarity, setSelectedRarity] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [revealedNfaId, setRevealedNfaId] = useState<string | null>(null);
  const [revealedRarity, setRevealedRarity] = useState<number | null>(null);
  const [revealedShelter, setRevealedShelter] = useState<number | null>(null);

  const { data: mintingActive } = useMintingActive();
  const { data: mintedCount } = useMintedCount();
  const { data: totalSupply } = useTotalSupply();
  const { data: rarityMinted } = useRarityMinted();
  const { data: commitment } = useCommitment(address);

  const commitMint = useCommitMint();
  const revealMint = useRevealMint();
  const refundHook = useRefund();
  const { data: vaultOwner } = useVaultOwner();
  const ownerMintHook = useOwnerMint();

  const isOwner = isConnected && address && vaultOwner && address.toLowerCase() === (vaultOwner as string).toLowerCase();
  const [ownerRarity, setOwnerRarity] = useState(0);
  const [ownerRecipient, setOwnerRecipient] = useState('');
  const [ownerSimError, setOwnerSimError] = useState<string | null>(null);

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
      setDebugError(t('mint.noSalt'));
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
  // Use NFA totalSupply (includes ownerMint), fallback to vault mintedCount
  const totalMinted = totalSupply !== undefined ? Number(totalSupply) : (mintedCount !== undefined ? Number(mintedCount) : 0);

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
      {/* ═══ LEFT: Stats & Info (hidden on mobile, compact sidebar on desktop) ═══ */}
      <div className="pipboy-split-sidebar hidden sm:block" style={{ width: 220 }}>
        {/* Progress */}
        <div className="px-3 py-2">
          <div className="term-bright text-xs glow mb-2">{t('mint.progress')}</div>
          <div className="flex items-center gap-2 text-xs mb-1">
            <span className="term-dim">{t('mint.total')}</span>
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
                  {getRarityName(r, isCN)}
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
          <div className="term-bright text-xs glow mb-1">{t('mint.instructions')}</div>
          <div>{t('mint.inst1')}</div>
          <div>{t('mint.inst2')}</div>
          <div>{t('mint.inst3')}</div>
          <div>{t('mint.inst4')}</div>
          <div className="term-warn">{t('mint.inst5')}</div>
        </div>
      </div>

      {/* ═══ RIGHT: Mint Action ═══ */}
      <div className="pipboy-split-content flex flex-col">
        {/* Mobile compact header */}
        <div className="sm:hidden mb-2 text-xs flex items-center justify-between">
          <span className="term-bright glow">{t('mint.genesis')}</span>
          <span className="term-dim">{totalMinted}/{TOTAL_GENESIS}</span>
        </div>
        <div className="hidden sm:block term-bright text-sm glow mb-3">{t('mint.genesis')}</div>

        {!isConnected ? (
          <div className="term-dim text-sm py-8 text-center">
            {t('mint.connectWallet')}
          </div>
        ) : mintingActive === false ? (
          <div className="term-warn text-sm py-8 text-center">
            {t('mint.notStarted')}
          </div>
        ) : (
          <div className="space-y-3 flex-1">
            {/* Phase: SELECT */}
            {phase === 'select' && (
              <>
                <div className="text-xs term-dim">{t('mint.selectRarity')}</div>
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
                        {getRarityName(r, isCN)}
                        {' '}{RARITY_PRICES[r]} {nativeSymbol}
                        {' '}· {t('mint.airdrop')} {RARITY_AIRDROPS[r]} Claworld
                        {getRarityStars(r) ? ` ${getRarityStars(r)}` : ''}
                        {soldOut ? ` ${t('mint.soldOut')}` : ''}
                      </button>
                    );
                  })}
                </div>

                <div className="term-line my-2" />

                <div className="text-xs space-y-1">
                  <div className="term-dim">
                    {t('mint.selected')} <span className={getRarityClass(selectedRarity)}>{getRarityName(selectedRarity, isCN)}</span>
                  </div>
                  <div className="term-dim">
                    {t('mint.cost')} <span className="term-bright">{RARITY_PRICES[selectedRarity]} {nativeSymbol}</span>
                    {' '}· {t('mint.airdrop')}: <span className="term-bright">{RARITY_AIRDROPS[selectedRarity]} Claworld</span>
                  </div>
                </div>

                <button
                  onClick={handleCommit}
                  disabled={commitMint.isPending || commitMint.isConfirming}
                  className="term-btn term-btn-primary text-sm w-full"
                >
                  [{commitMint.isPending ? t('mint.signing') : commitMint.isConfirming ? t('mint.confirming') : `${t('mint.confirmMint')} — ${RARITY_PRICES[selectedRarity]} ${nativeSymbol}`}]
                </button>

                {commitMint.hash && (
                  <a href={getBscScanTxUrl(commitMint.hash)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
                    [{t('mint.viewTx')}]
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
                <div className="term-warn text-sm">{t('mint.waiting')}</div>
                <div className="term-bright text-2xl glow-strong">{formatTime(countdown)}</div>
                <div className="term-dim text-xs">{t('mint.committed')}</div>
              </div>
            )}

            {/* Phase: READY */}
            {phase === 'ready' && (
              <div className="space-y-3">
                <div className="text-sm term-bright glow">{t('mint.revealOpen')}</div>
                <div className="term-dim text-xs">
                  {t('mint.revealTime')} <span className="term-warn">{formatTime(countdown)}</span>
                </div>
                {!savedSalt && (
                  <div className="term-danger text-xs">
                    {t('mint.noSalt')}
                  </div>
                )}
                <button
                  onClick={handleReveal}
                  disabled={revealMint.isPending || revealMint.isConfirming || !savedSalt}
                  className="term-btn term-btn-primary text-sm w-full"
                >
                  [{revealMint.isPending ? t('mint.signing') : revealMint.isConfirming ? t('mint.confirming') : t('mint.revealBtn')}]
                </button>
                {revealMint.hash && (
                  <a href={getBscScanTxUrl(revealMint.hash)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
                    [{t('mint.viewTx')}]
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
                <div className="term-danger text-sm">{t('mint.expired')}</div>
                <div className="term-dim text-xs">
                  {t('mint.expiredDesc')} {nativeSymbol}。
                </div>
                <button
                  onClick={handleRefund}
                  disabled={refundHook.isPending || refundHook.isConfirming}
                  className="term-btn term-btn-primary text-sm w-full"
                >
                  [{refundHook.isPending ? t('mint.signing') : refundHook.isConfirming ? t('mint.confirming') : t('mint.refund')}]
                </button>
                {refundHook.hash && (
                  <a href={getBscScanTxUrl(refundHook.hash)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
                    [{t('mint.viewTx')}]
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
                <div className="term-bright text-lg glow-strong">{t('mint.success')}</div>
                <div className="term-dim text-sm">{t('mint.successDesc')}</div>
                {revealMint.hash && (
                  <a href={getBscScanTxUrl(revealMint.hash)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
                    [{t('mint.viewMintTx')}]
                  </a>
                )}
                <div className="flex justify-center gap-3 pt-2">
                  <Link href="/nfa" className="term-btn term-btn-primary text-sm">
                    [{t('mint.viewCollection')}]
                  </Link>
                  <button onClick={handleReset} className="term-btn text-sm">
                    [{t('mint.mintAnother')}]
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Owner free mint */}
        {isOwner && (
          <>
            <div className="term-line my-3" />
            <div className="space-y-2">
              <div className="term-warn text-xs glow">{t('mint.adminFree')}</div>
              <div className="flex gap-2 items-center flex-wrap">
                {[0, 1, 2, 3, 4].map((r) => (
                  <button
                    key={r}
                    onClick={() => setOwnerRarity(r)}
                    className={`text-xs ${ownerRarity === r ? `${getRarityClass(r)} glow` : 'term-dim hover:text-crt-green'}`}
                  >
                    [{ownerRarity === r ? '>' : ' '}{getRarityName(r, isCN)}]
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder={t('mint.recipientPlaceholder')}
                value={ownerRecipient}
                onChange={(e) => setOwnerRecipient(e.target.value)}
                className="w-full bg-transparent border border-crt-green/30 text-crt-green text-xs px-2 py-1 placeholder:text-crt-green/20 focus:outline-none focus:border-crt-green/60"
              />
              <button
                onClick={async () => {
                  setOwnerSimError(null);
                  ownerMintHook.reset();
                  const rawRecipient = ownerRecipient.trim();
                  if (rawRecipient && !isAddress(rawRecipient)) {
                    setOwnerSimError(t('mint.invalidAddr'));
                    return;
                  }
                  const recipient = (rawRecipient || address) as Address;
                  try {
                    await simulateContract(config, {
                      ...vaultContract,
                      functionName: 'ownerMint',
                      args: [ownerRarity, recipient],
                      account: address,
                    });
                  } catch (err: any) {
                    console.error('[ownerMint simulate]', err);
                    console.error('[ownerMint] account:', address, 'recipient:', recipient, 'rarity:', ownerRarity);
                    const raw = err?.shortMessage || err?.message || String(err);
                    setOwnerSimError(raw);
                    return;
                  }
                  ownerMintHook.ownerMint(ownerRarity, recipient);
                }}
                disabled={ownerMintHook.isPending || ownerMintHook.isConfirming}
                className="term-btn term-btn-primary text-xs w-full"
              >
                [{ownerMintHook.isPending ? t('mint.signing') : ownerMintHook.isConfirming ? t('mint.confirming') : `${t('mint.freeMint')} ${getRarityName(ownerRarity, isCN)}`}]
              </button>
              {ownerMintHook.hash && (
                <a href={getBscScanTxUrl(ownerMintHook.hash)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
                  [{t('mint.viewTx')}]
                </a>
              )}
              {ownerMintHook.isSuccess && (
                <>
                  <div className="term-bright text-xs glow">{t('mint.success')}</div>
                  <button onClick={() => ownerMintHook.reset()} className="term-btn text-xs">
                    [{t('mint.continueBtn')}]
                  </button>
                </>
              )}
              {ownerMintHook.error && (
                <div className="term-danger text-xs">
                  [!] {(ownerMintHook.error as any)?.shortMessage || ownerMintHook.error.message}
                </div>
              )}
              {ownerSimError && (
                <div className="term-danger text-xs">
                  [{t('mint.simFail')}] {ownerSimError}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
