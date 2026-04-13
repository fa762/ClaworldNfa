'use client';

import Link from 'next/link';
import { ArrowUpRight, Shield, TimerReset, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { ERC20ABI } from '@/contracts/abis/ERC20';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type ClaimPanelProps = {
  matchId?: bigint;
  claimable: bigint;
  claimPath?: 'owner' | 'autonomy' | null;
  hasConflict: boolean;
};

function getClaimSubmitError(
  error: unknown,
  pick: <T,>(zh: T, en: T) => T,
  contractBalance?: bigint,
  claimable?: bigint,
) {
  if (!(error instanceof Error)) return pick('领取提交失败。', 'Claim submit failed.');
  if (error.message.includes('User rejected') || error.message.includes('OKX Wallet Reject')) {
    return pick('钱包取消了这次领取签名。', 'Wallet signature was cancelled.');
  }
  if (error.message.includes('transfer amount exceeds balance')) {
    return pick(
      `奖池合约余额不够。合约仅有 ${formatCLW(contractBalance ?? 0n)}，当前待领 ${formatCLW(claimable ?? 0n)}。`,
      `Prize contract balance is too low. Contract ${formatCLW(contractBalance ?? 0n)}, claim ${formatCLW(claimable ?? 0n)}.`,
    );
  }
  if (error.message.includes('Match not settled')) return pick('这局还没结算完。', 'This match is not settled yet.');
  if (error.message.includes('Already claimed')) return pick('这笔奖励已经领过了。', 'This reward was already claimed.');
  return error.message;
}

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
  const contractBalanceQuery = useReadContract({
    address: addresses.clwToken,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: [addresses.battleRoyale],
    query: {
      enabled: Boolean(addresses.clwToken && addresses.battleRoyale),
      refetchInterval: 5000,
    },
  });

  const contractBalance = BigInt(contractBalanceQuery.data?.toString() ?? '0');
  const contractFundingReady = claimable === 0n || contractBalance >= claimable;

  const canOwnerClaim =
    matchId !== undefined &&
    claimable > 0n &&
    claimPath === 'owner' &&
    !hasConflict &&
    contractFundingReady;
  const needsAutonomyRequest =
    matchId !== undefined && claimable > 0n && claimPath === 'autonomy' && !hasConflict;

  const blocker = useMemo(() => {
    if (hasConflict) return pick('领取路径冲突，先不要直接领取。', 'Claim path conflict.');
    if (claimPath === 'owner' && claimable > 0n && !contractFundingReady) {
      return pick(
        `当前是手动领取路径，但大逃杀合约余额不足。合约仅有 ${formatCLW(contractBalance)}，待领 ${formatCLW(claimable)}。`,
        `Owner claim path is selected, but the Battle Royale contract only has ${formatCLW(contractBalance)} for a ${formatCLW(claimable)} claim.`,
      );
    }
    if (needsAutonomyRequest) return pick('这笔奖励要去代理页发领取请求。', 'This reward must be claimed from Auto.');
    if (claimable === 0n) return pick('当前没有可领取奖励。', 'No settled reward is ready.');
    return null;
  }, [claimPath, claimable, contractBalance, contractFundingReady, hasConflict, needsAutonomyRequest, pick]);

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
      // error rendered below
    } finally {
      setAwaitingWallet(false);
    }
  }

  return (
    <section className={`cw-panel ${canOwnerClaim ? 'cw-panel--warm' : 'cw-panel--cool'}`}>
      <div className="cw-section-head">
        <div>
          <span className="cw-label">{pick('奖励领取', 'Claim')}</span>
          <h3>
            {claimable > 0n
              ? pick(`可领 ${formatCLW(claimable)}`, `Claim ${formatCLW(claimable)}`)
              : pick('暂无奖励', 'No reward')}
          </h3>
        </div>
        <span className={`cw-chip ${canOwnerClaim ? 'cw-chip--warm' : claimable > 0n ? 'cw-chip--alert' : 'cw-chip--cool'}`}>
          <Trophy size={14} />
          {matchId !== undefined ? `#${matchId.toString()}` : 'idle'}
        </span>
      </div>

      <div className="cw-state-grid">
        <div className="cw-state-card">
          <span className="cw-label">{pick('奖励', 'Reward')}</span>
          <strong>{claimable > 0n ? formatCLW(claimable) : '--'}</strong>
        </div>
        <div className="cw-state-card">
          <span className="cw-label">{pick('路径', 'Path')}</span>
          <strong>
            {claimPath === 'owner'
              ? pick('手动领取', 'Owner claim')
              : claimPath === 'autonomy'
                ? pick('代理领取', 'Autonomy claim')
                : '--'}
          </strong>
        </div>
        <div className="cw-state-card">
          <span className="cw-label">{pick('状态', 'Status')}</span>
          <strong>
            {canOwnerClaim
              ? pick('可领取', 'Ready')
              : claimable > 0n
                ? pick('被阻塞', 'Blocked')
                : pick('等待中', 'Waiting')}
          </strong>
        </div>
      </div>

      {blocker ? (
        <div className="cw-list">
          <div className={`cw-list-item ${hasConflict || !contractFundingReady ? 'cw-list-item--alert' : 'cw-list-item--cool'}`}>
            <Shield size={16} />
            <span>{blocker}</span>
          </div>
        </div>
      ) : null}

      {awaitingWallet ? (
        <div className="cw-list">
          <div className="cw-list-item cw-list-item--warm">
            <Shield size={16} />
            <span>{pick('请到钱包里确认领取。', 'Confirm the claim in wallet.')}</span>
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
              ? pick('等待签名', 'Waiting')
              : receiptQuery.isLoading
                ? pick('链上确认中', 'Confirming')
                : pick(`领取 ${formatCLW(claimable)}`, `Claim ${formatCLW(claimable)}`)}
          </button>
        ) : needsAutonomyRequest ? (
          <Link href="/auto" className="cw-button cw-button--secondary">
            <TimerReset size={16} />
            {pick('去代理页领取', 'Go to Auto')}
          </Link>
        ) : (
          <button type="button" className="cw-button cw-button--ghost" disabled>
            <Shield size={16} />
            {pick('暂不可领', 'Blocked')}
          </button>
        )}
      </div>

      {hash ? (
        <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="cw-inline-link">
          {pick('查看交易', 'View transaction')} <ArrowUpRight size={14} />
        </a>
      ) : null}

      {receiptQuery.isSuccess ? (
        <p className="cw-result-celebration">{pick('奖励领取成功。', 'Reward claimed.')}</p>
      ) : null}
      {error ? (
        <p className="cw-muted">{getClaimSubmitError(error, pick, contractBalance, claimable)}</p>
      ) : null}
    </section>
  );
}
