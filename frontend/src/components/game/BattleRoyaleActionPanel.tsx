'use client';

import Link from 'next/link';
import { ExternalLink, Shield, Swords, TimerReset } from 'lucide-react';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';
import { useBattleRoyaleParticipantState } from '@/components/lobster/useBattleRoyaleParticipantState';

type BattleRoyaleActionPanelProps = {
  matchId: bigint | undefined;
  status: number;
  totalPlayers: number;
  triggerCount: number;
  pot: bigint;
  participant: ReturnType<typeof useBattleRoyaleParticipantState>;
  compact?: boolean;
};

function matchStatusText(status: number) {
  if (status === 0) return 'Open';
  if (status === 1) return 'Pending reveal';
  if (status === 2) return 'Settled';
  return 'Unknown';
}

export function BattleRoyaleActionPanel({
  matchId,
  status,
  totalPlayers,
  triggerCount,
  pot,
  participant,
  compact = false,
}: BattleRoyaleActionPanelProps) {
  const canOwnerClaim =
    matchId !== undefined &&
    participant.claimable > 0n &&
    participant.preferredPath?.key === 'owner' &&
    !participant.hasConflict;

  const needsAutonomyClaim =
    participant.claimable > 0n &&
    participant.preferredPath?.key === 'autonomy' &&
    !participant.hasConflict;

  const { data: hash, error, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function handleOwnerClaim() {
    if (!canOwnerClaim || matchId === undefined) return;
    writeContract({
      address: addresses.battleRoyale,
      abi: BattleRoyaleABI,
      functionName: 'claim',
      args: [matchId],
    });
  }

  const headline = participant.hasConflict
    ? 'Participant conflict needs review'
    : canOwnerClaim
      ? `Claim ${formatCLW(participant.claimable)} now`
      : needsAutonomyClaim
        ? `Autonomy claim ready for ${formatCLW(participant.claimable)}`
        : participant.entered
          ? `Tracked in room ${participant.preferredPath?.roomId ?? 0}`
          : matchId !== undefined
            ? `Match #${matchId.toString()} ${matchStatusText(status)}`
            : 'No readable match';

  const detail = participant.hasConflict
    ? 'Both owner and autonomy participant paths look populated. Do not show a blind claim CTA here.'
    : canOwnerClaim
      ? 'This reward is on the owner-wallet path, so the connected wallet can claim directly.'
      : needsAutonomyClaim
        ? 'This reward sits on the autonomy participant path. Resolve it from the autonomy surface instead of sending a direct owner claim.'
        : participant.entered
          ? `Participation is tracked via ${participant.claimPathLabel}. Pot ${formatCLW(pot)} with ${totalPlayers}/${triggerCount} players.`
          : matchId !== undefined
            ? `Pot ${formatCLW(pot)} with ${totalPlayers}/${triggerCount} players.`
            : 'Battle Royale state is not readable yet.';

  return (
    <section className={`cw-panel ${canOwnerClaim ? 'cw-panel--warm' : 'cw-panel--cool'}`}>
      <div className="cw-section-head">
        <div>
          <span className="cw-label">Battle Royale action</span>
          <h3>{headline}</h3>
          <p className="cw-muted">{detail}</p>
        </div>
        <span className={`cw-chip ${canOwnerClaim ? 'cw-chip--warm' : needsAutonomyClaim ? 'cw-chip--cool' : 'cw-chip--growth'}`}>
          <Shield size={14} />
          {matchId !== undefined ? `#${matchId.toString()}` : 'idle'}
        </span>
      </div>

      <div className="cw-button-row">
        {canOwnerClaim ? (
          <button type="button" className="cw-button cw-button--primary" onClick={handleOwnerClaim} disabled={isPending || isConfirming}>
            <Swords size={16} />
            {isPending ? 'Sign claim' : isConfirming ? 'Confirming' : `Claim ${formatCLW(participant.claimable)}`}
          </button>
        ) : needsAutonomyClaim ? (
          <Link href="/auto" className="cw-button cw-button--secondary">
            <TimerReset size={16} />
            Resolve via autonomy
          </Link>
        ) : (
          <Link href="/arena" className="cw-button cw-button--secondary">
            <Swords size={16} />
            {participant.entered ? 'Open arena state' : 'Review arena'}
          </Link>
        )}

        <Link href="/arena" className="cw-button cw-button--ghost">
          <Shield size={16} />
          {compact ? 'Arena' : 'Arena details'}
        </Link>
      </div>

      {hash ? (
        <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="cw-inline-link">
          View transaction <ExternalLink size={14} />
        </a>
      ) : null}

      {isSuccess ? <p className="cw-muted">Claim transaction confirmed. The match readout will catch up after refetch.</p> : null}
      {error ? <p className="cw-muted">Claim failed to submit: {error.message}</p> : null}
    </section>
  );
}
