'use client';

import Link from 'next/link';
import { ArrowUpRight, Shield, TimerReset, Trophy } from 'lucide-react';
import { useState } from 'react';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type ClaimPanelProps = {
  matchId?: bigint;
  claimable: bigint;
  claimPath?: 'owner' | 'autonomy' | null;
  hasConflict: boolean;
};

export function BattleRoyaleClaimPanel({
  matchId,
  claimable,
  claimPath,
  hasConflict,
}: ClaimPanelProps) {
  const { pick } = useI18n();
  const [awaitingWallet, setAwaitingWallet] = useState(false);
  const { data: hash, error, writeContractAsync } = useWriteContract();
  const receiptQuery = useWaitForTransactionReceipt({ hash });

  const canOwnerClaim =
    matchId !== undefined && claimable > 0n && claimPath === 'owner' && !hasConflict;
  const needsAutonomyRequest =
    matchId !== undefined && claimable > 0n && claimPath === 'autonomy' && !hasConflict;

  async function handleClaim() {
    if (!canOwnerClaim || matchId === undefined) return;
    setAwaitingWallet(true);
    try {
      await writeContractAsync({
        address: addresses.battleRoyale,
        abi: BattleRoyaleABI,
        functionName: 'claim',
        args: [matchId],
      });
    } catch {
      // wagmi error renders below
    } finally {
      setAwaitingWallet(false);
    }
  }

  const headline = hasConflict
    ? pick('结算奖励路径冲突，需要人工确认', 'Settled reward needs manual path review')
    : canOwnerClaim
      ? pick(`领取第 #${matchId?.toString()} 场的 ${formatCLW(claimable)}`, `Claim ${formatCLW(claimable)} from match #${matchId?.toString()}`)
      : needsAutonomyRequest
        ? pick(`把 ${formatCLW(claimable)} 交给自治路径领取`, `Queue autonomy claim for ${formatCLW(claimable)}`)
        : pick('当前没有可领取的结算奖励', 'No settled Battle Royale reward is ready');

  const detail = hasConflict
    ? pick('owner 和 autonomy 两条 claim 路径同时出现有效状态，先不要继续发 claim。', 'Both owner and autonomy participant paths show settled state. Block claim CTAs until the path is clear.')
    : canOwnerClaim
      ? pick('这笔奖励走 owner-wallet 路径，当前钱包可直接领取。', 'This reward sits on the owner-wallet path, so the connected wallet can claim it directly from Arena.')
      : needsAutonomyRequest
        ? pick('这笔奖励走 autonomy participant 路径，应该去自治页发 request。', 'This reward sits on the autonomy participant path. Send it to the operator/request surface instead of signing a direct owner claim.')
        : pick('现在还只有实时对局状态，等 recent-match 扫描到 settled 奖励后会显示在这里。', 'Arena is still showing live match state only. A settled reward will surface here once the recent-match scan finds one.');

  return (
    <section className={`cw-panel ${canOwnerClaim ? 'cw-panel--warm' : needsAutonomyRequest ? 'cw-panel--cool' : 'cw-panel--presence'}`}>
      <div className="cw-section-head">
        <div>
          <span className="cw-label">{pick('结算领取', 'Settled claim')}</span>
          <h3>{headline}</h3>
          <p className="cw-muted">{detail}</p>
        </div>
        <span className={`cw-chip ${canOwnerClaim ? 'cw-chip--warm' : needsAutonomyRequest ? 'cw-chip--cool' : 'cw-chip--alert'}`}>
          <Trophy size={14} />
          {matchId !== undefined ? `#${matchId.toString()}` : 'idle'}
        </span>
      </div>

      <div className="cw-presence-grid">
        <div className="cw-presence-card">
          <span>{pick('奖励', 'Reward')}</span>
          <strong>{claimable > 0n ? formatCLW(claimable) : '--'}</strong>
        </div>
        <div className="cw-presence-card">
          <span>{pick('路径', 'Claim path')}</span>
          <strong>{claimPath === 'owner' ? pick('Owner 钱包', 'Owner wallet') : claimPath === 'autonomy' ? pick('自治 participant', 'Autonomy') : pick('未找到', 'Not found')}</strong>
        </div>
        <div className="cw-presence-card">
          <span>{pick('状态', 'Status')}</span>
          <strong>{hasConflict ? pick('冲突', 'Conflict') : claimable > 0n ? pick('可领取', 'Ready') : pick('等待中', 'Waiting')}</strong>
        </div>
      </div>

      {awaitingWallet ? (
        <div className="cw-list">
          <div className="cw-list-item cw-list-item--warm">
            <Shield size={16} />
            <span>{pick('正在等待钱包签名，请到钱包里确认领取交易。', 'Waiting for wallet signature. Open the wallet and confirm the claim transaction.')}</span>
          </div>
        </div>
      ) : null}

      <div className="cw-button-row">
        {canOwnerClaim ? (
          <button
            type="button"
            className="cw-button cw-button--primary"
            onClick={handleClaim}
            disabled={awaitingWallet || receiptQuery.isLoading}
          >
            <Trophy size={16} />
            {awaitingWallet
              ? pick('等待签名', 'Waiting for signature')
              : receiptQuery.isLoading
                ? pick('链上确认中', 'Confirming')
                : pick(`领取 ${formatCLW(claimable)}`, `Claim ${formatCLW(claimable)}`)}
          </button>
        ) : needsAutonomyRequest ? (
          <Link href="/auto" className="cw-button cw-button--secondary">
            <TimerReset size={16} />
            {pick('打开自治请求', 'Open autonomy request')}
          </Link>
        ) : (
          <Link href="/auto" className="cw-button cw-button--ghost">
            <Shield size={16} />
            {pick('查看自治页', 'Review autonomy')}
          </Link>
        )}
      </div>

      {hash ? (
        <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="cw-inline-link">
          {pick('查看领取交易', 'View claim transaction')} <ArrowUpRight size={14} />
        </a>
      ) : null}
      {receiptQuery.isSuccess ? <p className="cw-result-celebration">{pick('奖励已成功领取。', 'Reward claim confirmed.')}</p> : null}
      {error ? <p className="cw-muted">{pick(`领取提交失败：${error.message}`, `Claim failed to submit: ${error.message}`)}</p> : null}
    </section>
  );
}
