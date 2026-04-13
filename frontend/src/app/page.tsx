'use client';

import Link from 'next/link';
import { ArrowRight, Coins, Shield, Sparkles, Swords, TimerReset } from 'lucide-react';

import { CompanionUpkeepPanel } from '@/components/lobster/CompanionUpkeepPanel';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useBattleRoyaleClaimWindow } from '@/components/lobster/useBattleRoyaleClaimWindow';
import { useBattleRoyaleOverview } from '@/components/lobster/useBattleRoyaleOverview';
import { useBattleRoyaleParticipantState } from '@/components/lobster/useBattleRoyaleParticipantState';
import { AUTONOMY_PROTOCOL_ID, useAutonomyProofs } from '@/contracts/hooks/useAutonomy';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

function receiptStatusText(status: number, pick: <T,>(zh: T, en: T) => T) {
  if (status === 4) return pick('已执行', 'Executed');
  if (status === 5) return pick('失败', 'Failed');
  if (status === 3) return pick('已完成', 'Finalized');
  if (status === 2) return pick('等待执行', 'Synced');
  if (status === 1) return pick('已排队', 'Fulfilled');
  return pick('等待中', 'Pending');
}

function battleRoyaleStateText(status: number, pick: <T,>(zh: T, en: T) => T) {
  if (status === 0) return pick('开放中', 'Open');
  if (status === 1) return pick('待揭示', 'Pending reveal');
  if (status === 2) return pick('已结算', 'Settled');
  return pick('未知', 'Unknown');
}

export default function HomePage() {
  const { pick } = useI18n();
  const companion = useActiveCompanion();
  const battleRoyale = useBattleRoyaleOverview();
  const battleRoyaleParticipant = useBattleRoyaleParticipantState(
    battleRoyale.matchId,
    companion.hasToken ? companion.tokenId : undefined,
    companion.ownerAddress,
  );
  const claimWindow = useBattleRoyaleClaimWindow(
    companion.hasToken ? companion.tokenId : undefined,
    companion.ownerAddress,
  );
  const proofs = useAutonomyProofs(
    companion.hasToken ? companion.tokenId : undefined,
    AUTONOMY_PROTOCOL_ID.battleRoyale,
  );

  const latestReceipt = proofs.receipts?.[0] as
    | {
        requestId?: bigint;
        status?: number;
        actualSpend?: bigint;
      }
    | undefined;

  const isCompanionLoading = companion.isLoading && companion.connected && companion.hasToken;
  const claimableAmount = claimWindow.claimable > 0n ? claimWindow.claimable : battleRoyaleParticipant.claimable;

  const actionCards = [
    {
      href: '/play',
      icon: Sparkles,
      title: pick('任务挖矿', 'Task Mining'),
      value: companion.active ? pick('开始挖矿', 'Start mining') : pick('先维护', 'Upkeep first'),
      meta: companion.active ? companion.routerClaworldText : companion.dailyCostText,
      tone: companion.active ? 'cw-card--ready' : 'cw-card--warning',
    },
    {
      href: '/arena',
      icon: Swords,
      title: pick('竞技', 'Arena'),
      value:
        claimableAmount > 0n
          ? pick(`奖励待领 ${formatCLW(claimableAmount)}`, `Claim ${formatCLW(claimableAmount)}`)
          : battleRoyale.ready
            ? battleRoyaleStateText(battleRoyale.status, pick)
            : pick('查看 PK / 大逃杀', 'Open PK / BR'),
      meta:
        battleRoyale.ready && battleRoyale.triggerCount > 0
          ? `${battleRoyale.totalPlayers}/${battleRoyale.triggerCount}`
          : `${companion.pkWins}胜 / ${companion.pkLosses}败`,
      tone: claimableAmount > 0n ? 'cw-card--ready' : 'cw-card--watch',
    },
    {
      href: '/auto',
      icon: TimerReset,
      title: pick('代理', 'Auto'),
      value: latestReceipt
        ? pick(
            `请求 #${latestReceipt.requestId?.toString() ?? '-'} ${receiptStatusText(Number(latestReceipt.status ?? 0), pick)}`,
            `Req #${latestReceipt.requestId?.toString() ?? '-'} ${receiptStatusText(Number(latestReceipt.status ?? 0), pick)}`,
          )
        : pick('设置策略', 'Set strategy'),
      meta: latestReceipt ? formatCLW(BigInt(latestReceipt.actualSpend ?? 0n)) : pick('受控', 'Bounded'),
      tone: latestReceipt && Number(latestReceipt.status ?? 0) === 5 ? 'cw-card--warning' : 'cw-card--safe',
    },
  ] as const;

  return (
    <>
      {companion.connected && !companion.hasToken ? (
        <section className="cw-panel cw-panel--cool">
          <div className="cw-section-head">
            <div>
              <span className="cw-label">{pick('没有龙虾', 'No companion')}</span>
              <h3>{pick('先去铸造一只', 'Mint one first')}</h3>
            </div>
            <span className="cw-chip cw-chip--alert">
              <Shield size={14} />
              {pick('先铸造', 'Mint first')}
            </span>
          </div>
          <div className="cw-button-row">
            <Link href="/mint" className="cw-button cw-button--primary">
              <ArrowRight size={16} />
              {pick('前往铸造', 'Go to mint')}
            </Link>
          </div>
        </section>
      ) : null}

      <section className="cw-section">
        <div className="cw-section-head">
          <h2 className="cw-section-title">{pick('下一步', 'Next')}</h2>
        </div>
        {isCompanionLoading ? (
          <div className="cw-card-stack">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`home-action-loading-${index}`} className="cw-skeleton-block cw-skeleton-block--card" />
            ))}
          </div>
        ) : (
          <div className="cw-card-stack">
            {actionCards.map(({ href, icon: Icon, title, value, meta, tone }) => (
              <Link key={title} href={href} className={`cw-card ${tone}`}>
                <div className="cw-card-icon">
                  <Icon size={18} />
                </div>
                <div className="cw-card-copy">
                  <p className="cw-label">{title}</p>
                  <h3>{value}</h3>
                </div>
                <div className="cw-score">
                  <strong>{meta}</strong>
                  <span>{pick('查看', 'Open')}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {companion.connected && companion.hasToken ? (
        <CompanionUpkeepPanel
          tokenId={companion.tokenId}
          ownerAddress={companion.ownerAddress}
          reserve={companion.routerClaworld}
          dailyCost={companion.dailyCost}
          upkeepDays={companion.upkeepDays}
        />
      ) : null}

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('当前结果', 'Current result')}</span>
            <h3>
              {claimableAmount > 0n
                ? pick(`有奖励待领 ${formatCLW(claimableAmount)}`, `Claim ${formatCLW(claimableAmount)}`)
                : latestReceipt
                  ? pick(
                      `最新请求 #${latestReceipt.requestId?.toString() ?? '-'} ${receiptStatusText(Number(latestReceipt.status ?? 0), pick)}`,
                      `Latest request #${latestReceipt.requestId?.toString() ?? '-'} ${receiptStatusText(Number(latestReceipt.status ?? 0), pick)}`,
                    )
                  : pick('暂无新结果', 'No recent result')}
            </h3>
          </div>
          <span className="cw-chip cw-chip--cool">
            <Coins size={14} />
            {claimableAmount > 0n ? pick('可领取', 'Ready') : pick('实时', 'Live')}
          </span>
        </div>
      </section>
    </>
  );
}
