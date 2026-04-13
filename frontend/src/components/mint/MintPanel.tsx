'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Compass,
  Gift,
  Shield,
  Sparkles,
  TimerReset,
} from 'lucide-react';
import { simulateContract } from '@wagmi/core';
import { parseEther, zeroHash } from 'viem';
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
  useMintingActive,
  useMintedCount,
  useRarityMinted,
  useRefund,
  useRevealMint,
  vaultContract,
} from '@/contracts/hooks/useGenesisVault';
import { useI18n } from '@/lib/i18n';
import { getRarityName, getRarityStars } from '@/lib/rarity';

const TOTAL_GENESIS = 888;
const REVEAL_DELAY = 60;
const REVEAL_WINDOW = 86400;

type Phase = 'select' | 'waiting' | 'ready' | 'expired' | 'success';

function formatCountdown(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) return `${hours}小时 ${minutes}分`;
  if (minutes > 0) return `${minutes}分 ${secs}秒`;
  return `${secs}秒`;
}

function rarityTone(rarity: number) {
  if (rarity >= 4) return 'cw-card--warning';
  if (rarity === 3) return 'cw-card--watch';
  if (rarity === 2) return 'cw-card--ready';
  return 'cw-card--safe';
}

function mintError(error: unknown) {
  if (!(error instanceof Error)) return '铸造失败。';
  const message = error.message;
  if (message.includes('User rejected') || message.includes('OKX Wallet Reject')) return '钱包取消了这次签名。';
  if (message.includes('insufficient funds')) return '钱包 BNB 不足。';
  if (message.includes('Already committed')) return '这个钱包已经有一笔进行中的铸造。';
  return message;
}

export function MintPanel() {
  const { address, isConnected } = useAccount();
  const { lang } = useI18n();
  const isCN = lang === 'zh';

  const [selectedRarity, setSelectedRarity] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const { data: mintingActive } = useMintingActive();
  const { data: mintedCount } = useMintedCount();
  const { data: rarityMinted } = useRarityMinted();
  const { data: totalSupply } = useTotalSupply();
  const { data: commitment } = useCommitment(address);

  const commitMint = useCommitMint();
  const revealMint = useRevealMint();
  const refundHook = useRefund();

  const commitHash = commitment?.[0] as `0x${string}` | undefined;
  const commitTimestamp = commitment?.[2] ? Number(commitment[2]) : 0;
  const commitRevealed = commitment?.[3] as boolean | undefined;
  const hasActiveCommit = Boolean(commitHash && commitHash !== zeroHash && !commitRevealed);
  const totalMinted =
    totalSupply !== undefined ? Number(totalSupply) : mintedCount !== undefined ? Number(mintedCount) : 0;
  const raritySold = (rarityMinted as readonly bigint[] | undefined) ?? [];

  const phase = useMemo<Phase>(() => {
    if (revealed) return 'success';
    if (!hasActiveCommit) return 'select';
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - commitTimestamp;
    if (elapsed < REVEAL_DELAY) return 'waiting';
    if (elapsed < REVEAL_WINDOW) return 'ready';
    return 'expired';
  }, [commitTimestamp, hasActiveCommit, revealed]);

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

  useEffect(() => {
    if (revealMint.isSuccess && address) {
      clearSalt(address);
      setRevealed(true);
    }
  }, [address, revealMint.isSuccess]);

  useEffect(() => {
    if (refundHook.isSuccess && address) {
      clearSalt(address);
    }
  }, [address, refundHook.isSuccess]);

  const mintBlockedReason = !isConnected
    ? '先连接钱包。'
    : mintingActive === false
      ? '当前还没开放铸造。'
      : hasActiveCommit
        ? '这个钱包已经有一笔进行中的铸造。'
        : null;

  async function handleCommit() {
    if (!address) return;
    const salt = generateSalt();
    saveSalt(address, salt, selectedRarity);
    const hash = computeCommitHash(selectedRarity, salt, address);
    setErrorText(null);
    commitMint.commitMint(hash, parseEther(RARITY_PRICES[selectedRarity]));
  }

  async function handleReveal() {
    if (!address) return;
    const saved = loadSalt(address);
    if (!saved) {
      setErrorText('本地没有找到这笔铸造的揭示凭据。');
      return;
    }
    if (!commitHash || commitHash === zeroHash) {
      setErrorText('链上没有找到当前钱包的铸造承诺。');
      return;
    }
    const localHash = computeCommitHash(saved.rarity, saved.salt, address);
    if (localHash.toLowerCase() !== commitHash.toLowerCase()) {
      setErrorText('本地凭据和链上承诺不一致。');
      return;
    }

    setErrorText(null);
    try {
      await simulateContract(config, {
        ...vaultContract,
        functionName: 'reveal',
        args: [saved.rarity, saved.salt],
        account: address,
      });
    } catch (error) {
      setErrorText(mintError(error));
      return;
    }

    revealMint.revealMint(saved.rarity, saved.salt);
  }

  return (
    <div className="cw-page">
      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">Genesis</span>
            <h3>铸造你的龙虾</h3>
          </div>
          <span className="cw-chip cw-chip--warm">
            <Compass size={14} />
            {totalMinted}/{TOTAL_GENESIS}
          </span>
        </div>

        <div className="cw-state-grid">
          <div className="cw-state-card">
            <span className="cw-label">总进度</span>
            <strong>{totalMinted}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">稀有度</span>
            <strong>{getRarityName(selectedRarity, isCN)}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">空投</span>
            <strong>{RARITY_AIRDROPS[selectedRarity]} Claworld</strong>
          </div>
        </div>
      </section>

      {phase === 'select' ? (
        <>
          <section className="cw-choice-grid">
            {[0, 1, 2, 3, 4].map((rarity) => {
              const minted = Number(raritySold[rarity] ?? 0n);
              const soldOut = minted >= RARITY_CAPS[rarity];
              return (
                <button
                  key={rarity}
                  type="button"
                  className={`cw-choice-card ${rarityTone(rarity)} ${selectedRarity === rarity ? 'cw-choice-card--selected' : ''}`}
                  onClick={() => !soldOut && setSelectedRarity(rarity)}
                  disabled={soldOut}
                >
                  <span>
                    {getRarityName(rarity, isCN)} {getRarityStars(rarity)}
                  </span>
                  <strong>{RARITY_PRICES[rarity]} BNB</strong>
                  <em>{soldOut ? '已售罄' : `${minted}/${RARITY_CAPS[rarity]}`}</em>
                </button>
              );
            })}
          </section>

          <section className="cw-panel cw-panel--cool">
            <div className="cw-stage-stats">
              <div className="cw-mini-stat">
                <span>价格</span>
                <strong>{RARITY_PRICES[selectedRarity]} BNB</strong>
              </div>
              <div className="cw-mini-stat">
                <span>空投</span>
                <strong>{RARITY_AIRDROPS[selectedRarity]} Claworld</strong>
              </div>
              <div className="cw-mini-stat">
                <span>状态</span>
                <strong>{mintBlockedReason ? '暂不可用' : '可铸造'}</strong>
              </div>
            </div>

            <div className="cw-button-row">
              <button
                type="button"
                className="cw-button cw-button--primary"
                onClick={() => void handleCommit()}
                disabled={Boolean(mintBlockedReason) || commitMint.isPending || commitMint.isConfirming}
              >
                <Sparkles size={16} />
                {commitMint.isPending
                  ? '等钱包签名'
                  : commitMint.isConfirming
                    ? '链上确认中'
                    : `支付 ${RARITY_PRICES[selectedRarity]} BNB`}
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
              <span className="cw-label">等待揭示</span>
              <h3>倒计时结束后再揭示</h3>
              <div className="cw-result-celebration">{formatCountdown(countdown)}</div>
            </div>
          </div>
        </section>
      ) : null}

      {phase === 'ready' ? (
        <section className="cw-panel cw-panel--warm">
          <div className="cw-section-head">
            <div>
              <span className="cw-label">揭示</span>
              <h3>现在可以揭示</h3>
            </div>
            <span className="cw-chip cw-chip--warm">
              <Gift size={14} />
              {formatCountdown(countdown)}
            </span>
          </div>

          <div className="cw-button-row">
            <button
              type="button"
              className="cw-button cw-button--primary"
              onClick={() => void handleReveal()}
              disabled={revealMint.isPending || revealMint.isConfirming}
            >
              <Sparkles size={16} />
              {revealMint.isPending
                ? '等钱包签名'
                : revealMint.isConfirming
                  ? '链上确认中'
                  : '立即揭示'}
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'expired' ? (
        <section className="cw-panel cw-panel--cool">
          <div className="cw-section-head">
            <div>
              <span className="cw-label">窗口已过</span>
              <h3>这笔铸造只能退款</h3>
            </div>
            <span className="cw-chip cw-chip--alert">
              <Shield size={14} />
              已过期
            </span>
          </div>

          <div className="cw-button-row">
            <button
              type="button"
              className="cw-button cw-button--primary"
              onClick={() => refundHook.refund()}
              disabled={refundHook.isPending || refundHook.isConfirming}
            >
              <TimerReset size={16} />
              {refundHook.isPending
                ? '等钱包签名'
                : refundHook.isConfirming
                  ? '链上确认中'
                  : '申请退款'}
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
              <span className="cw-label">铸造完成</span>
              <h3>新的龙虾已经加入你的编组</h3>
              <div className="cw-result-celebration">+{RARITY_AIRDROPS[selectedRarity]} Claworld</div>
            </div>
          </div>

          <div className="cw-button-row">
            <Link href="/" className="cw-button cw-button--secondary">
              <Compass size={16} />
              返回首页
            </Link>
            <button type="button" className="cw-button cw-button--ghost" onClick={() => setRevealed(false)}>
              继续铸造
            </button>
          </div>
        </section>
      ) : null}

      {(mintBlockedReason || errorText || commitMint.error || revealMint.error || refundHook.error) ? (
        <div className="cw-list">
          {mintBlockedReason ? (
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>{mintBlockedReason}</span>
            </div>
          ) : null}
          {errorText ? (
            <div className="cw-list-item cw-list-item--alert">
              <Shield size={16} />
              <span>{errorText}</span>
            </div>
          ) : null}
          {commitMint.error ? (
            <div className="cw-list-item cw-list-item--alert">
              <Shield size={16} />
              <span>{mintError(commitMint.error)}</span>
            </div>
          ) : null}
          {revealMint.error ? (
            <div className="cw-list-item cw-list-item--alert">
              <Shield size={16} />
              <span>{mintError(revealMint.error)}</span>
            </div>
          ) : null}
          {refundHook.error ? (
            <div className="cw-list-item cw-list-item--alert">
              <Shield size={16} />
              <span>{mintError(refundHook.error)}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {(commitMint.hash || revealMint.hash || refundHook.hash) ? (
        <a
          href={getBscScanTxUrl((revealMint.hash || refundHook.hash || commitMint.hash)!)}
          target="_blank"
          rel="noopener noreferrer"
          className="cw-inline-link"
        >
          查看交易 <ArrowUpRight size={14} />
        </a>
      ) : null}
    </div>
  );
}
