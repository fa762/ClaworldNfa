'use client';

import Link from 'next/link';
import { ExternalLink, Shield, Swords, TimerReset } from 'lucide-react';
import { useState } from 'react';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
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

function matchStatusText(status: number, pick: <T,>(zh: T, en: T) => T) {
  if (status === 0) return pick('开放中', 'Open');
  if (status === 1) return pick('待 reveal', 'Pending reveal');
  if (status === 2) return pick('已结算', 'Settled');
  return pick('未知', 'Unknown');
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
  const { pick } = useI18n();
  const canOwnerClaim =
    matchId !== undefined &&
    participant.claimable > 0n &&
    participant.preferredPath?.key === 'owner' &&
    !participant.hasConflict;

  const needsAutonomyClaim =
    participant.claimable > 0n &&
    participant.preferredPath?.key === 'autonomy' &&
    !participant.hasConflict;

  const [awaitingWallet, setAwaitingWallet] = useState(false);
  const { data: hash, error, writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  async function handleOwnerClaim() {
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
      // handled by wagmi error state
    } finally {
      setAwaitingWallet(false);
    }
  }

  const headline = participant.hasConflict
    ? pick('参赛路径冲突，需要先人工确认', 'Participant conflict needs review')
    : canOwnerClaim
      ? pick(`现在可领 ${formatCLW(participant.claimable)}`, `Claim ${formatCLW(participant.claimable)} now`)
      : needsAutonomyClaim
        ? pick(`自治路径可领 ${formatCLW(participant.claimable)}`, `Autonomy claim ready for ${formatCLW(participant.claimable)}`)
        : participant.entered
          ? pick(`已在房间 ${participant.preferredPath?.roomId ?? 0}`, `Tracked in room ${participant.preferredPath?.roomId ?? 0}`)
          : matchId !== undefined
            ? pick(`第 #${matchId.toString()} 场 ${matchStatusText(status, pick)}`, `Match #${matchId.toString()} ${matchStatusText(status, pick)}`)
            : pick('暂时没有可读的对局', 'No readable match');

  const detail = participant.hasConflict
    ? pick('owner 和 autonomy 两条 participant 路径都像是有效状态，先不要展示盲领按钮。', 'Both owner and autonomy participant paths look populated. Do not show a blind claim CTA here.')
    : canOwnerClaim
      ? pick('这笔奖励属于 owner-wallet 路径，当前钱包可以直接领取。', 'This reward is on the owner-wallet path, so the connected wallet can claim directly.')
      : needsAutonomyClaim
        ? pick('这笔奖励在 autonomy participant 路径上，去自治页面发 request，不要直接 owner claim。', 'This reward sits on the autonomy participant path. Resolve it from the autonomy surface instead of sending a direct owner claim.')
        : participant.entered
          ? pick(`当前通过 ${participant.claimPathLabel} 参赛。奖池 ${formatCLW(pot)}，人数 ${totalPlayers}/${triggerCount}。`, `Participation is tracked via ${participant.claimPathLabel}. Pot ${formatCLW(pot)} with ${totalPlayers}/${triggerCount} players.`)
          : matchId !== undefined
            ? pick(`奖池 ${formatCLW(pot)}，人数 ${totalPlayers}/${triggerCount}。`, `Pot ${formatCLW(pot)} with ${totalPlayers}/${triggerCount} players.`)
            : pick('Battle Royale 状态还没读到。', 'Battle Royale state is not readable yet.');

  return (
    <section className={`cw-panel ${canOwnerClaim ? 'cw-panel--warm' : 'cw-panel--cool'}`}>
      <div className="cw-section-head">
        <div>
          <span className="cw-label">{pick('Battle Royale 行动', 'Battle Royale action')}</span>
          <h3>{headline}</h3>
          <p className="cw-muted">{detail}</p>
        </div>
        <span className={`cw-chip ${canOwnerClaim ? 'cw-chip--warm' : needsAutonomyClaim ? 'cw-chip--cool' : 'cw-chip--growth'}`}>
          <Shield size={14} />
          {matchId !== undefined ? `#${matchId.toString()}` : 'idle'}
        </span>
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
          <button type="button" className="cw-button cw-button--primary" onClick={handleOwnerClaim} disabled={awaitingWallet || isConfirming}>
            <Swords size={16} />
            {awaitingWallet
              ? pick('等待签名', 'Waiting for signature')
              : isConfirming
                ? pick('链上确认中', 'Confirming')
                : pick(`领取 ${formatCLW(participant.claimable)}`, `Claim ${formatCLW(participant.claimable)}`)}
          </button>
        ) : needsAutonomyClaim ? (
          <Link href="/auto" className="cw-button cw-button--secondary">
            <TimerReset size={16} />
            {pick('去自治页处理', 'Resolve via autonomy')}
          </Link>
        ) : (
          <Link href="/arena" className="cw-button cw-button--secondary">
            <Swords size={16} />
            {participant.entered ? pick('打开竞技状态', 'Open arena state') : pick('查看竞技入口', 'Review arena')}
          </Link>
        )}

        <Link href="/arena" className="cw-button cw-button--ghost">
          <Shield size={16} />
          {compact ? pick('竞技', 'Arena') : pick('竞技详情', 'Arena details')}
        </Link>
      </div>

      {hash ? (
        <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="cw-inline-link">
          {pick('查看交易', 'View transaction')} <ExternalLink size={14} />
        </a>
      ) : null}

      {isSuccess ? <p className="cw-result-celebration">{pick('领取已确认，结算摘要马上刷新。', 'Claim confirmed. The settled summary will refresh shortly.')}</p> : null}
      {error ? <p className="cw-muted">{pick(`领取提交失败：${error.message}`, `Claim failed to submit: ${error.message}`)}</p> : null}
    </section>
  );
}
