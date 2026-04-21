'use client';

import Link from 'next/link';
import { ExternalLink, Shield, Swords } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { useBattleRoyaleParticipantState } from '@/components/lobster/useBattleRoyaleParticipantState';
import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { TerminalActionIntent } from '@/lib/terminal-cards';

type BattleRoyaleActionPanelProps = {
  matchId: bigint | undefined;
  status: number;
  totalPlayers: number;
  triggerCount: number;
  pot: bigint;
  participant: ReturnType<typeof useBattleRoyaleParticipantState>;
  compact?: boolean;
  onOpenIntent?: (intent: TerminalActionIntent) => void;
};

function matchStatusText(status: number, pick: <T,>(zh: T, en: T) => T) {
  if (status === 0) return pick('开放中', 'Open');
  if (status === 1) return pick('待揭示', 'Pending reveal');
  if (status === 2) return pick('已结算', 'Settled');
  return pick('未知', 'Unknown');
}

function getClaimSubmitError(error: unknown, pick: <T,>(zh: T, en: T) => T) {
  if (!(error instanceof Error)) return pick('领取提交失败。', 'Claim submit failed.');
  if (error.message.includes('User rejected') || error.message.includes('OKX Wallet Reject')) {
    return pick('钱包取消了这次领奖签名。', 'Wallet signature was cancelled.');
  }
  return error.message;
}

export function BattleRoyaleActionPanel({
  matchId,
  status,
  totalPlayers,
  triggerCount,
  pot,
  participant,
  compact = false,
  onOpenIntent,
}: BattleRoyaleActionPanelProps) {
  const { pick } = useI18n();
  const [awaitingWallet, setAwaitingWallet] = useState(false);
  const { data: hash, error, writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const canOwnerClaim =
    matchId !== undefined &&
    participant.claimable > 0n &&
    participant.preferredPath?.key === 'owner' &&
    !participant.hasConflict;
  const canReserveClaim =
    participant.claimable > 0n &&
    participant.preferredPath?.key === 'autonomy' &&
    !participant.hasConflict;
  const returnsToLedger = Boolean(
    participant.preferredPath?.effectiveNfa && participant.preferredPath.effectiveNfa > 0n,
  );

  const blocker = useMemo(() => {
    if (participant.hasConflict) return pick('参赛路径冲突，先不要直接领取。', 'Participant path conflict.');
    if ((canOwnerClaim || canReserveClaim) && returnsToLedger) {
      return pick(
        '这笔奖励会回到这只 NFA 的记账账户，随后可去首页维护里提现。',
        'This reward returns to the NFA ledger account.',
      );
    }
    if (participant.entered) return null;
    if (matchId !== undefined) return pick(`当前第 #${matchId.toString()} 场可查看。`, `Match #${matchId.toString()} is available.`);
    return pick('暂时没有可读的大逃杀对局。', 'No readable Battle Royale match.');
  }, [
    canOwnerClaim,
    canReserveClaim,
    matchId,
    participant.entered,
    participant.hasConflict,
    pick,
    returnsToLedger,
  ]);

  async function handleClaim() {
    if (matchId === undefined || (!canOwnerClaim && !canReserveClaim)) return;
    setAwaitingWallet(true);
    try {
      await writeContractAsync({
        address: addresses.battleRoyale,
        abi: BattleRoyaleABI,
        functionName: canReserveClaim ? 'claimForNfa' : 'claim',
        args:
          canReserveClaim && participant.preferredPath?.effectiveNfa
            ? [matchId, participant.preferredPath.effectiveNfa]
            : [matchId],
      });
    } catch {
      // rendered below
    } finally {
      setAwaitingWallet(false);
    }
  }

  return (
    <section className={`cw-panel ${canOwnerClaim ? 'cw-panel--warm' : 'cw-panel--cool'}`}>
      <div className="cw-section-head">
        <div>
          <span className="cw-label">{pick('大逃杀', 'Battle Royale')}</span>
          <h3>
            {participant.claimable > 0n
              ? pick(`可领 ${formatCLW(participant.claimable)}`, `Claim ${formatCLW(participant.claimable)}`)
              : matchId !== undefined
                ? pick(`第 #${matchId.toString()} 场 · ${matchStatusText(status, pick)}`, `Match #${matchId.toString()} · ${matchStatusText(status, pick)}`)
                : pick('暂无对局', 'No match')}
          </h3>
        </div>
        <span className={`cw-chip ${canOwnerClaim ? 'cw-chip--warm' : participant.entered ? 'cw-chip--growth' : 'cw-chip--cool'}`}>
          <Shield size={14} />
          {matchId !== undefined ? `#${matchId.toString()}` : 'idle'}
        </span>
      </div>

      <div className="cw-state-grid">
        <div className="cw-state-card">
          <span className="cw-label">{pick('奖池', 'Pot')}</span>
          <strong>{formatCLW(pot)}</strong>
        </div>
        <div className="cw-state-card">
          <span className="cw-label">{pick('人数', 'Players')}</span>
          <strong>{triggerCount > 0 ? `${totalPlayers}/${triggerCount}` : '--'}</strong>
        </div>
        <div className="cw-state-card">
          <span className="cw-label">{pick('状态', 'Status')}</span>
          <strong>
            {canOwnerClaim
              ? pick('可领取', 'Ready')
              : participant.entered
                ? pick('已参赛', 'Entered')
                : matchStatusText(status, pick)}
          </strong>
        </div>
      </div>

      {blocker ? (
        <div className="cw-list">
          <div className={`cw-list-item ${participant.hasConflict ? 'cw-list-item--alert' : 'cw-list-item--cool'}`}>
            <Shield size={16} />
            <span>{blocker}</span>
          </div>
        </div>
      ) : null}

      {awaitingWallet ? (
        <div className="cw-list">
          <div className="cw-list-item cw-list-item--warm">
            <Shield size={16} />
            <span>{pick('请到钱包里确认领奖。', 'Confirm the claim in wallet.')}</span>
          </div>
        </div>
      ) : null}

      <div className="cw-button-row">
        {canOwnerClaim || canReserveClaim ? (
          <button
            type="button"
            className="cw-button cw-button--primary"
            onClick={handleClaim}
            disabled={awaitingWallet || isConfirming}
          >
            <Swords size={16} />
            {awaitingWallet
              ? pick('等待签名', 'Waiting')
              : isConfirming
                ? pick('链上确认中', 'Confirming')
                : returnsToLedger
                  ? pick(`领回记账账户 ${formatCLW(participant.claimable)}`, `Return ${formatCLW(participant.claimable)}`)
                  : pick(`领取 ${formatCLW(participant.claimable)}`, `Claim ${formatCLW(participant.claimable)}`)}
          </button>
        ) : (
          onOpenIntent ? (
            <button type="button" className="cw-button cw-button--secondary" onClick={() => onOpenIntent('arena')}>
              <Swords size={16} />
              {participant.entered ? pick('查看赛况', 'View arena') : pick('查看对局', 'View arena')}
            </button>
          ) : (
            <Link href="/arena" className="cw-button cw-button--secondary">
              <Swords size={16} />
              {participant.entered ? pick('查看赛况', 'View arena') : pick('查看对局', 'View arena')}
            </Link>
          )
        )}

        {onOpenIntent ? (
          <button type="button" className="cw-button cw-button--ghost" onClick={() => onOpenIntent('arena')}>
            <Shield size={16} />
            {compact ? pick('竞技', 'Arena') : pick('竞技详情', 'Arena details')}
          </button>
        ) : (
          <Link href="/arena" className="cw-button cw-button--ghost">
            <Shield size={16} />
            {compact ? pick('竞技', 'Arena') : pick('竞技详情', 'Arena details')}
          </Link>
        )}
        {returnsToLedger ? (
          onOpenIntent ? (
            <button type="button" className="cw-button cw-button--ghost" onClick={() => onOpenIntent('status')}>
              <Shield size={16} />
              {pick('查看状态', 'View status')}
            </button>
          ) : (
            <Link href="/" className="cw-button cw-button--ghost">
              <Shield size={16} />
              {pick('去维护提现', 'Withdraw on home')}
            </Link>
          )
        ) : null}
      </div>

      {hash ? (
        <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="cw-inline-link">
          {pick('查看交易', 'View transaction')} <ExternalLink size={14} />
        </a>
      ) : null}

      {isSuccess ? <p className="cw-result-celebration">{pick('领奖已确认。', 'Claim confirmed.')}</p> : null}
      {error ? <p className="cw-muted">{getClaimSubmitError(error, pick)}</p> : null}
    </section>
  );
}
