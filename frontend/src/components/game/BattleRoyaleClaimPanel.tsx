'use client';

import Link from 'next/link';
import { ArrowUpRight, Shield, TimerReset, Trophy } from 'lucide-react';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';

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
  const { data: hash, error, isPending, writeContract } = useWriteContract();
  const receiptQuery = useWaitForTransactionReceipt({ hash });

  const canOwnerClaim =
    matchId !== undefined && claimable > 0n && claimPath === 'owner' && !hasConflict;
  const needsAutonomyRequest =
    matchId !== undefined && claimable > 0n && claimPath === 'autonomy' && !hasConflict;

  function handleClaim() {
    if (!canOwnerClaim || matchId === undefined) return;

    writeContract({
      address: addresses.battleRoyale,
      abi: BattleRoyaleABI,
      functionName: 'claim',
      args: [matchId],
    });
  }

  const headline = hasConflict
    ? 'Settled reward needs manual path review'
    : canOwnerClaim
      ? `Claim ${formatCLW(claimable)} from match #${matchId?.toString()}`
      : needsAutonomyRequest
        ? `Queue autonomy claim for ${formatCLW(claimable)}`
        : 'No settled Battle Royale reward is ready';

  const detail = hasConflict
    ? 'Both owner and autonomy participant paths show settled state. Block claim CTAs until the path is clear.'
    : canOwnerClaim
      ? 'This reward sits on the owner-wallet path, so the connected wallet can claim it directly from Arena.'
      : needsAutonomyRequest
        ? 'This reward sits on the autonomy participant path. Send it to the operator/request surface instead of signing a direct owner claim.'
        : 'Arena is still showing live match state only. A settled reward will surface here once the recent-match scan finds one.';

  return (
    <section className={`cw-panel ${canOwnerClaim ? 'cw-panel--warm' : needsAutonomyRequest ? 'cw-panel--cool' : 'cw-panel--presence'}`}>
      <div className="cw-section-head">
        <div>
          <span className="cw-label">Settled claim</span>
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
          <span>Reward</span>
          <strong>{claimable > 0n ? formatCLW(claimable) : '--'}</strong>
        </div>
        <div className="cw-presence-card">
          <span>Claim path</span>
          <strong>{claimPath === 'owner' ? 'Owner wallet' : claimPath === 'autonomy' ? 'Autonomy' : 'Not found'}</strong>
        </div>
        <div className="cw-presence-card">
          <span>Status</span>
          <strong>{hasConflict ? 'Conflict' : claimable > 0n ? 'Ready' : 'Waiting'}</strong>
        </div>
      </div>

      <div className="cw-button-row">
        {canOwnerClaim ? (
          <button
            type="button"
            className="cw-button cw-button--primary"
            onClick={handleClaim}
            disabled={isPending || receiptQuery.isLoading}
          >
            <Trophy size={16} />
            {isPending ? 'Sign claim' : receiptQuery.isLoading ? 'Confirming' : `Claim ${formatCLW(claimable)}`}
          </button>
        ) : needsAutonomyRequest ? (
          <Link href="/auto" className="cw-button cw-button--secondary">
            <TimerReset size={16} />
            Open autonomy request
          </Link>
        ) : (
          <Link href="/auto" className="cw-button cw-button--ghost">
            <Shield size={16} />
            Review autonomy
          </Link>
        )}
      </div>

      {hash ? (
        <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="cw-inline-link">
          View claim transaction <ArrowUpRight size={14} />
        </a>
      ) : null}
      {receiptQuery.isSuccess ? <p className="cw-muted">Owner claim confirmed. The settled-match summary will catch up on refetch.</p> : null}
      {error ? <p className="cw-muted">Claim failed to submit: {error.message}</p> : null}
    </section>
  );
}
