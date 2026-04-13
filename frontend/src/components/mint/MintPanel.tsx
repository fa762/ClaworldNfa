'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Compass, Gift, Shield, Sparkles, TimerReset } from 'lucide-react';
import { simulateContract } from '@wagmi/core';
import { isAddress, parseEther, type Address, zeroHash } from 'viem';
import { useAccount } from 'wagmi';

import { config } from '@/components/wallet/WalletProvider';
import { getBscScanTxUrl } from '@/contracts/addresses';
import { useTotalSupply } from '@/contracts/hooks/useClawNFA';
import {
  clearSalt,
  computeCommitHash,
  generateSalt,
  loadSalt,
  RARITY_AIRDROPS,
  RARITY_CAPS,
  RARITY_PRICES,
  saveSalt,
  useCommitment,
  useCommitMint,
  useMintedCount,
  useMintingActive,
  useOwnerMint,
  useRarityMinted,
  useRefund,
  useRevealMint,
  useVaultOwner,
  vaultContract,
} from '@/contracts/hooks/useGenesisVault';
import { useI18n } from '@/lib/i18n';
import { getRarityName, getRarityStars } from '@/lib/rarity';

const TOTAL_GENESIS = 888;
const REVEAL_DELAY = 60;
const REVEAL_WINDOW = 86400;

type Phase = 'select' | 'waiting' | 'ready' | 'expired' | 'success';

function formatCountdown(totalSeconds: number, pick: <T,>(zh: T, en: T) => T) {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return pick(`${hours}小时 ${minutes}分`, `${hours}h ${minutes}m`);
  if (minutes > 0) return pick(`${minutes}分 ${seconds}秒`, `${minutes}m ${seconds}s`);
  return pick(`${seconds}秒`, `${seconds}s`);
}

function rarityTone(rarity: number) {
  if (rarity >= 4) return 'cw-card--warning';
  if (rarity === 3) return 'cw-card--watch';
  if (rarity === 2) return 'cw-card--ready';
  return 'cw-card--safe';
}

export function MintPanel() {
  const { address, isConnected } = useAccount();
  const { lang, pick } = useI18n();
  const isCN = lang === 'zh';

  const [selectedRarity, setSelectedRarity] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [revealedNfaId, setRevealedNfaId] = useState<string | null>(null);
  const [ownerRarity, setOwnerRarity] = useState(0);
  const [ownerRecipient, setOwnerRecipient] = useState('');
  const [ownerSimError, setOwnerSimError] = useState<string | null>(null);

  const { data: mintingActive } = useMintingActive();
  const { data: mintedCount } = useMintedCount();
  const { data: totalSupply } = useTotalSupply();
  const { data: rarityMinted } = useRarityMinted();
  const { data: commitment } = useCommitment(address);
  const { data: vaultOwner } = useVaultOwner();

  const commitMint = useCommitMint();
  const revealMint = useRevealMint();
  const refundHook = useRefund();
  const ownerMintHook = useOwnerMint();

  const commitHash = commitment?.[0] as `0x${string}` | undefined;
  const commitTimestamp = commitment?.[2] ? Number(commitment[2]) : 0;
  const commitRevealed = commitment?.[3] as boolean | undefined;
  const hasActiveCommit = Boolean(commitHash && commitHash !== zeroHash && !commitRevealed);
  const isOwner =
    Boolean(isConnected && address && vaultOwner) &&
    address!.toLowerCase() === (vaultOwner as string).toLowerCase();

  const totalMinted =
    totalSupply !== undefined ? Number(totalSupply) : mintedCount !== undefined ? Number(mintedCount) : 0;

  const phase = useMemo<Phase>(() => {
    if (revealedNfaId) return 'success';
    if (!hasActiveCommit) return 'select';
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - commitTimestamp;
    if (elapsed < REVEAL_DELAY) return 'waiting';
    if (elapsed < REVEAL_WINDOW) return 'ready';
    return 'expired';
  }, [commitTimestamp, hasActiveCommit, revealedNfaId]);

  useEffect(() => {
    if (!hasActiveCommit) {
      setCountdown(0);
      return;
    }

    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - commitTimestamp;
      if (elapsed < REVEAL_DELAY) {
        setCountdown(REVEAL_DELAY - elapsed);
        return;
      }
      if (elapsed < REVEAL_WINDOW) {
        setCountdown(REVEAL_WINDOW - elapsed);
        return;
      }
      setCountdown(0);
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [commitTimestamp, hasActiveCommit]);

  const savedSalt = address ? loadSalt(address) : null;
  const selectedPrice = RARITY_PRICES[selectedRarity];
  const selectedAirdrop = RARITY_AIRDROPS[selectedRarity];

  function handleCommit() {
    if (!address) return;
    const salt = generateSalt();
    saveSalt(address, salt, selectedRarity);
    const hash = computeCommitHash(selectedRarity, salt, address);
    commitMint.commitMint(hash, parseEther(selectedPrice));
  }

  async function handleReveal() {
    if (!address) return;
    const saved = loadSalt(address);
    if (!saved) {
      setDebugError(pick('本地没找到铸造凭据，当前设备无法继续揭示。', 'No local reveal bundle was found on this device.'));
      return;
    }

    if (!commitHash || commitHash === zeroHash) {
      setDebugError(pick('链上没有当前钱包的铸造承诺。', 'No active mint commitment was found on-chain.'));
      return;
    }

    const localHash = computeCommitHash(saved.rarity, saved.salt, address);
    if (localHash.toLowerCase() !== commitHash.toLowerCase()) {
      setDebugError(pick('本地凭据和链上承诺不一致，只能用原设备继续揭示。', 'The local reveal bundle does not match the on-chain commitment.'));
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
    } catch (error: any) {
      setDebugError(error?.shortMessage || error?.message || String(error));
      return;
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
    }
  }, [address, revealMint.isSuccess]);

  useEffect(() => {
    if (refundHook.isSuccess && address) {
      clearSalt(address);
    }
  }, [address, refundHook.isSuccess]);

  function handleReset() {
    setRevealedNfaId(null);
    setDebugError(null);
    commitMint.reset();
    revealMint.reset();
    refundHook.reset();
  }

  async function handleOwnerMint() {
    if (!address) return;
    setOwnerSimError(null);
    ownerMintHook.reset();

    const rawRecipient = ownerRecipient.trim();
    if (rawRecipient && !isAddress(rawRecipient)) {
      setOwnerSimError(pick('接收地址不合法。', 'Recipient address is invalid.'));
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
    } catch (error: any) {
      setOwnerSimError(error?.shortMessage || error?.message || String(error));
      return;
    }

    ownerMintHook.ownerMint(ownerRarity, recipient);
  }

  const mintBlockedReason = !isConnected
    ? pick('先连接钱包。', 'Connect wallet first.')
    : mintingActive === false
      ? pick('铸造还没开放。', 'Mint is not active yet.')
      : hasActiveCommit
        ? pick('当前钱包已经有一笔进行中的铸造。', 'This wallet already has an active mint.')
        : null;

  return (
    <div className="cw-page">
      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('Genesis 铸造', 'Genesis Mint')}</span>
            <h3>{pick('铸造你的龙虾', 'Mint your lobster')}</h3>
          </div>
          <span className="cw-chip cw-chip--warm">
            <Compass size={14} />
            {totalMinted}/{TOTAL_GENESIS}
          </span>
        </div>

        <div className="cw-state-grid">
          <div className="cw-state-card">
            <span className="cw-label">{pick('已铸造', 'Minted')}</span>
            <strong>{totalMinted}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">{pick('当前选择', 'Selected')}</span>
            <strong>{getRarityName(selectedRarity, isCN)}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">{pick('空投', 'Airdrop')}</span>
            <strong>{selectedAirdrop} Clawworld</strong>
          </div>
        </div>
      </section>

      {phase === 'select' ? (
        <>
          <section className="cw-card-stack">
            {[0, 1, 2, 3, 4].map((rarity) => {
              const minted = rarityMinted ? Number(rarityMinted[rarity]) : 0;
              const cap = RARITY_CAPS[rarity];
              const soldOut = minted >= cap;
              const selected = selectedRarity === rarity;

              return (
                <button
                  key={rarity}
                  type="button"
                  className={`cw-card cw-card--button ${rarityTone(rarity)} ${selected ? 'cw-card--selected' : ''}`}
                  onClick={() => !soldOut && setSelectedRarity(rarity)}
                  disabled={soldOut}
                >
                  <div className="cw-card-icon">
                    <Sparkles size={18} />
                  </div>
                  <div className="cw-card-copy">
                    <p className="cw-label">{getRarityName(rarity, isCN)}</p>
                    <h3>{RARITY_PRICES[rarity]} BNB</h3>
                  </div>
                  <div className="cw-score">
                    <strong>{RARITY_AIRDROPS[rarity]} Clawworld</strong>
                    <span>{soldOut ? pick('已售罄', 'Sold out') : `${minted}/${cap}`}</span>
                  </div>
                </button>
              );
            })}
          </section>

          <section className="cw-panel cw-panel--cool">
            <div className="cw-section-head">
              <div>
                <span className="cw-label">{pick('本次铸造', 'This mint')}</span>
                <h3>{getRarityName(selectedRarity, isCN)} {getRarityStars(selectedRarity)}</h3>
              </div>
              <span className={`cw-chip ${rarityTone(selectedRarity) === 'cw-card--warning' ? 'cw-chip--alert' : 'cw-chip--cool'}`}>
                <Gift size={14} />
                {selectedAirdrop}
              </span>
            </div>

            <div className="cw-state-grid">
              <div className="cw-state-card">
                <span className="cw-label">{pick('价格', 'Price')}</span>
                <strong>{selectedPrice} BNB</strong>
              </div>
              <div className="cw-state-card">
                <span className="cw-label">{pick('空投', 'Airdrop')}</span>
                <strong>{selectedAirdrop} Clawworld</strong>
              </div>
              <div className="cw-state-card">
                <span className="cw-label">{pick('状态', 'Status')}</span>
                <strong>{mintBlockedReason ? pick('被阻塞', 'Blocked') : pick('可铸造', 'Ready')}</strong>
              </div>
            </div>

            {mintBlockedReason ? (
              <div className="cw-list">
                <div className="cw-list-item cw-list-item--cool">
                  <Shield size={16} />
                  <span>{mintBlockedReason}</span>
                </div>
              </div>
            ) : null}

            <div className="cw-button-row">
              <button
                type="button"
                className="cw-button cw-button--primary"
                onClick={handleCommit}
                disabled={Boolean(mintBlockedReason) || commitMint.isPending || commitMint.isConfirming}
              >
                <Sparkles size={16} />
                {commitMint.isPending
                  ? pick('等待签名', 'Waiting')
                  : commitMint.isConfirming
                    ? pick('链上确认中', 'Confirming')
                    : pick(`支付 ${selectedPrice} BNB`, `Pay ${selectedPrice} BNB`)}
              </button>
            </div>
          </section>
        </>
      ) : null}

      {phase === 'waiting' ? (
        <section className="cw-result-panel cw-result-panel--success">
          <div className="cw-result-head">
            <div className="cw-result-icon">
              <TimerReset size={22} />
            </div>
            <div>
              <span className="cw-label">{pick('等待揭示', 'Waiting')}</span>
              <h3>{pick('倒计时结束后再揭示', 'Wait before reveal')}</h3>
              <div className="cw-result-celebration">{formatCountdown(countdown, pick)}</div>
            </div>
          </div>
        </section>
      ) : null}

      {phase === 'ready' ? (
        <section className="cw-panel cw-panel--warm">
          <div className="cw-section-head">
            <div>
              <span className="cw-label">{pick('揭示窗口', 'Reveal')}</span>
              <h3>{pick('现在可以揭示', 'Reveal is open')}</h3>
            </div>
            <span className="cw-chip cw-chip--warm">
              <TimerReset size={14} />
              {formatCountdown(countdown, pick)}
            </span>
          </div>

          {debugError ? (
            <div className="cw-list">
              <div className="cw-list-item cw-list-item--alert">
                <Shield size={16} />
                <span>{debugError}</span>
              </div>
            </div>
          ) : null}

          <div className="cw-button-row">
            <button
              type="button"
              className="cw-button cw-button--primary"
              onClick={handleReveal}
              disabled={revealMint.isPending || revealMint.isConfirming || !savedSalt}
            >
              <Sparkles size={16} />
              {revealMint.isPending
                ? pick('等待签名', 'Waiting')
                : revealMint.isConfirming
                  ? pick('链上确认中', 'Confirming')
                  : pick('立即揭示', 'Reveal now')}
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'expired' ? (
        <section className="cw-panel cw-panel--cool">
          <div className="cw-section-head">
            <div>
              <span className="cw-label">{pick('窗口已过', 'Expired')}</span>
              <h3>{pick('当前只能退款', 'Refund only')}</h3>
            </div>
            <span className="cw-chip cw-chip--alert">
              <Shield size={14} />
              {pick('已超时', 'Expired')}
            </span>
          </div>

          <div className="cw-button-row">
            <button
              type="button"
              className="cw-button cw-button--primary"
              onClick={handleRefund}
              disabled={refundHook.isPending || refundHook.isConfirming}
            >
              <TimerReset size={16} />
              {refundHook.isPending
                ? pick('等待签名', 'Waiting')
                : refundHook.isConfirming
                  ? pick('链上确认中', 'Confirming')
                  : pick('发起退款', 'Refund')}
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'success' ? (
        <section className="cw-result-panel cw-result-panel--success">
          <div className="cw-result-head">
            <div className="cw-result-icon">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <span className="cw-label">{pick('铸造完成', 'Minted')}</span>
              <h3>{pick('新的龙虾已经加入你的编组', 'New lobster minted')}</h3>
              <div className="cw-result-celebration">+{selectedAirdrop} Clawworld</div>
            </div>
          </div>

          <div className="cw-button-row">
            <Link href="/" className="cw-button cw-button--secondary">
              <Compass size={16} />
              {pick('返回首页', 'Back home')}
            </Link>
            <button type="button" className="cw-button cw-button--ghost" onClick={handleReset}>
              {pick('继续铸造', 'Mint again')}
            </button>
          </div>
        </section>
      ) : null}

      {(commitMint.hash || revealMint.hash || refundHook.hash) ? (
        <a
          href={getBscScanTxUrl((revealMint.hash || refundHook.hash || commitMint.hash)!)}
          target="_blank"
          rel="noopener noreferrer"
          className="cw-inline-link"
        >
          {pick('查看交易', 'View transaction')} <ArrowUpRight size={14} />
        </a>
      ) : null}

      {commitMint.error ? <p className="cw-muted">{commitMint.error.message}</p> : null}
      {revealMint.error ? <p className="cw-muted">{revealMint.error.message}</p> : null}
      {refundHook.error ? <p className="cw-muted">{refundHook.error.message}</p> : null}

      {isOwner ? (
        <details className="cw-advanced">
          <summary className="cw-advanced-summary">{pick('高级', 'Advanced')}</summary>
          <div className="cw-panel cw-panel--cool">
            <div className="cw-section-head">
              <div>
                <span className="cw-label">{pick('管理员铸造', 'Owner mint')}</span>
                <h3>{pick('免费发放', 'Free mint')}</h3>
              </div>
            </div>

            <div className="cw-card-stack">
              {[0, 1, 2, 3, 4].map((rarity) => (
                <button
                  key={rarity}
                  type="button"
                  className={`cw-card cw-card--button ${rarityTone(rarity)} ${ownerRarity === rarity ? 'cw-card--selected' : ''}`}
                  onClick={() => setOwnerRarity(rarity)}
                >
                  <div className="cw-card-copy">
                    <p className="cw-label">{pick('稀有度', 'Rarity')}</p>
                    <h3>{getRarityName(rarity, isCN)}</h3>
                  </div>
                </button>
              ))}
            </div>

            <label className="cw-field">
              <span className="cw-label">{pick('接收地址', 'Recipient')}</span>
              <input
                type="text"
                value={ownerRecipient}
                onChange={(event) => setOwnerRecipient(event.target.value)}
                className="cw-input"
                placeholder={pick('留空则发给当前钱包', 'Leave blank to mint to current wallet')}
              />
            </label>

            <div className="cw-button-row">
              <button
                type="button"
                className="cw-button cw-button--primary"
                onClick={() => void handleOwnerMint()}
                disabled={ownerMintHook.isPending || ownerMintHook.isConfirming}
              >
                <Sparkles size={16} />
                {ownerMintHook.isPending
                  ? pick('等待签名', 'Waiting')
                  : ownerMintHook.isConfirming
                    ? pick('链上确认中', 'Confirming')
                    : pick('发放', 'Mint')}
              </button>
            </div>

            {ownerSimError ? <p className="cw-muted">{ownerSimError}</p> : null}
            {ownerMintHook.error ? <p className="cw-muted">{ownerMintHook.error.message}</p> : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
