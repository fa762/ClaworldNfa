'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Coins,
  Flame,
  HeartPulse,
  Shield,
  Sparkles,
  Swords,
  TimerReset,
} from 'lucide-react';

import { BattleRoyaleActionPanel } from '@/components/game/BattleRoyaleActionPanel';
import { OwnedCompanionRail } from '@/components/lobster/OwnedCompanionRail';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useBattleRoyaleClaimWindow } from '@/components/lobster/useBattleRoyaleClaimWindow';
import { useBattleRoyaleOverview } from '@/components/lobster/useBattleRoyaleOverview';
import { useBattleRoyaleParticipantState } from '@/components/lobster/useBattleRoyaleParticipantState';
import { AUTONOMY_PROTOCOL_ID, useAutonomyProofs } from '@/contracts/hooks/useAutonomy';
import { formatCLW } from '@/lib/format';

function receiptStatusText(status: number) {
  if (status === 4) return 'Executed';
  if (status === 5) return 'Failed';
  if (status === 3) return 'Finalized';
  if (status === 2) return 'Synced';
  if (status === 1) return 'Fulfilled';
  return 'Pending';
}

function matchStatusText(status: number) {
  if (status === 0) return 'Open';
  if (status === 1) return 'Pending reveal';
  if (status === 2) return 'Settled';
  return 'Unknown';
}

export default function HomePage() {
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

  const latestReceipt = (proofs.receipts?.[0] ?? null) as
    | {
        requestId?: bigint;
        status?: number;
        actualSpend?: bigint;
        clwCredit?: bigint;
        lastError?: string;
      }
    | null;

  const todayCards = [
    {
      title: 'Task Ready',
      value: companion.active ? `${companion.name} can work now` : 'Needs upkeep first',
      detail: companion.active
        ? `Reserve ${companion.routerClaworldText}. ${companion.taskTotal} tasks already logged.`
        : 'Top up upkeep runway before starting another mining run.',
      icon: Sparkles,
      href: '/play',
      score: companion.active ? 'Now' : 'Wait',
      scoreLabel: companion.active ? 'best fit' : 'upkeep',
      tone: companion.active ? 'cw-card--ready' : 'cw-card--warning',
    },
    {
      title: 'Arena Watch',
      value: battleRoyale.ready
        ? claimWindow.claimable > 0n
          ? `Claim ready from match #${claimWindow.matchId?.toString() ?? '-'}`
          : `Match #${battleRoyale.matchId?.toString()} ${matchStatusText(battleRoyale.status)}`
        : `${companion.pkWinRate}% PK win rate`,
      detail: battleRoyale.ready
        ? `${battleRoyale.totalPlayers}/${battleRoyale.triggerCount} players / pot ${formatCLW(battleRoyale.pot)}${
            claimWindow.claimable > 0n
              ? ` / settled claim ${formatCLW(claimWindow.claimable)}`
              : battleRoyaleParticipant.claimable > 0n
                ? ` / claim ${formatCLW(battleRoyaleParticipant.claimable)}`
              : battleRoyaleParticipant.entered
                ? ` / entered via ${battleRoyaleParticipant.claimPathLabel}`
                : ''
          }`
        : 'Battle Royale and PK remain grouped under one competitive surface.',
      icon: Swords,
      href: '/arena',
      score: battleRoyale.ready ? `${battleRoyale.totalPlayers}/${battleRoyale.triggerCount}` : 'Watch',
      scoreLabel: battleRoyale.ready ? 'players' : 'event live',
      tone:
        claimWindow.claimable > 0n || battleRoyaleParticipant.claimable > 0n
          ? 'cw-card--ready'
          : battleRoyale.ready && battleRoyale.status === 0
            ? 'cw-card--warning'
            : 'cw-card--watch',
    },
    {
      title: 'Autonomy',
      value: latestReceipt
        ? `Req #${latestReceipt.requestId?.toString() ?? '-'} ${receiptStatusText(Number(latestReceipt.status ?? 0))}`
        : companion.sourceLabel,
      detail: latestReceipt
        ? `Spend ${formatCLW(BigInt(latestReceipt.actualSpend ?? 0n))} / credit ${formatCLW(BigInt(latestReceipt.clwCredit ?? 0n))}`
        : 'Directive, budget, and proof surfaces stay inside the bounded control path.',
      icon: TimerReset,
      href: '/auto',
      score: proofs.ledger ? `${proofs.ledger.executedCount}` : 'Bounded',
      scoreLabel: proofs.ledger ? 'executed' : 'policy',
      tone: latestReceipt && Number(latestReceipt.status ?? 0) === 5 ? 'cw-card--warning' : 'cw-card--safe',
    },
  ] as const;

  const traits = [
    { label: 'Courage', value: `${companion.traits.courage}`, width: `${companion.traits.courage}%` },
    {
      label: 'Wisdom',
      value: `${companion.traits.wisdom}`,
      width: `${companion.traits.wisdom}%`,
      tone: 'cw-meter--cool',
    },
    {
      label: 'Grit',
      value: `${companion.traits.grit}`,
      width: `${companion.traits.grit}%`,
      tone: 'cw-meter--growth',
    },
  ];

  const recentMotion = [
    {
      tone: 'cw-list-item--warm',
      text: `Wallet Claworld: ${companion.walletClaworldText}`,
    },
    {
      tone: 'cw-list-item--cool',
      text:
        companion.upkeepDays === null
          ? 'Upkeep runway not available'
          : `Upkeep runway: ${companion.upkeepDays} days at current reserve`,
    },
    {
      tone: battleRoyale.ready ? 'cw-list-item--warm' : 'cw-list-item--cool',
      text: battleRoyale.ready
        ? `Battle Royale #${battleRoyale.matchId?.toString()} is ${matchStatusText(battleRoyale.status)} with ${battleRoyale.totalPlayers}/${battleRoyale.triggerCount} players.`
        : 'No live Battle Royale match summary was readable from the contract.',
    },
    {
      tone:
        claimWindow.claimable > 0n || battleRoyaleParticipant.claimable > 0n
          ? 'cw-list-item--warm'
          : battleRoyaleParticipant.entered
            ? 'cw-list-item--cool'
            : latestReceipt && Number(latestReceipt.status ?? 0) === 5
              ? 'cw-list-item--cool'
              : 'cw-list-item--warm',
      text: claimWindow.claimable > 0n
        ? `Settled Battle Royale claimable: ${formatCLW(claimWindow.claimable)} via ${claimWindow.preferredPath?.key === 'autonomy' ? 'autonomy participant' : 'owner wallet'} in match #${claimWindow.matchId?.toString() ?? '-'}.`
        : battleRoyaleParticipant.claimable > 0n
          ? `Battle Royale claimable: ${formatCLW(battleRoyaleParticipant.claimable)} via ${battleRoyaleParticipant.claimPathLabel}.`
        : battleRoyaleParticipant.entered
          ? `Current match participation is tracked via ${battleRoyaleParticipant.claimPathLabel}.`
          : latestReceipt
            ? `Latest autonomy receipt: #${latestReceipt.requestId?.toString() ?? '-'} ${receiptStatusText(Number(latestReceipt.status ?? 0))}${
                latestReceipt.lastError ? ` / ${latestReceipt.lastError}` : ''
              }`
            : 'No recent Battle Royale autonomy receipt is visible for the active lobster.',
    },
  ];

  const presenceCards = [
    {
      label: 'Mood',
      value:
        !companion.connected ? 'Dormant'
        : !companion.active ? 'Hungry'
        : companion.upkeepDays !== null && companion.upkeepDays <= 1 ? 'Restless'
        : companion.pkWinRate >= 60 ? 'Fired up'
        : companion.taskTotal >= 10 ? 'Settled'
        : 'Attentive',
    },
    {
      label: 'Runway',
      value: companion.upkeepDays === null ? 'n/a' : `${companion.upkeepDays} days`,
    },
    {
      label: 'Focus',
      value:
        claimWindow.claimable > 0n
          ? 'Claim'
          : companion.active
            ? 'Task'
            : 'Upkeep',
    },
  ] as const;

  return (
    <>
      <section className="cw-band">
        <div className="cw-band--split">
          <div>
            <p className="cw-eyebrow">Today</p>
            <h2 className="cw-section-title">{companion.name} is the center of the loop.</h2>
            <p className="cw-muted">{companion.stance}</p>
          </div>
          <div className="cw-score">
            <strong>{companion.routerClaworldText}</strong>
            <span>reserve</span>
          </div>
        </div>
        <div className="cw-metrics">
          <div className="cw-metric">
            <span className="cw-label">Wallet Claworld</span>
            <strong>{companion.walletClaworldText}</strong>
          </div>
          <div className="cw-metric">
            <span className="cw-label">Owned NFAs</span>
            <strong>{companion.ownedCount}</strong>
          </div>
          <div className="cw-metric">
            <span className="cw-label">Daily upkeep</span>
            <strong>{companion.dailyCostText}</strong>
          </div>
        </div>
      </section>

      <OwnedCompanionRail
        title="Owned roster"
        subtitle="Keep the same page open while switching which lobster drives the live reads."
      />

      {companion.connected && !companion.hasToken ? (
        <section className="cw-panel cw-panel--cool">
          <div className="cw-section-head">
            <div>
              <span className="cw-label">No companion yet</span>
              <h3>This wallet is live, but it does not own a lobster yet.</h3>
              <p className="cw-muted">
                Mint one first so Home can switch from demo posture into real reserve, upkeep, mining, and arena state.
              </p>
            </div>
            <span className="cw-chip cw-chip--alert">
              <Shield size={14} />
              Mint first
            </span>
          </div>
          <div className="cw-button-row">
            <Link href="/mint" className="cw-button cw-button--primary">
              <ArrowRight size={16} />
              Go to mint
            </Link>
          </div>
        </section>
      ) : null}

      <section className="cw-section">
        <div className="cw-section-head">
          <h2 className="cw-section-title">Next moves</h2>
          <Link href="/companion" className="cw-inline-link">
            Companion view <ArrowRight size={14} />
          </Link>
        </div>
        <div className="cw-card-stack">
          {todayCards.map(({ title, value, detail, icon: Icon, href, score, scoreLabel, tone }) => (
            <Link key={title} href={href} className={`cw-card ${tone}`}>
              <div className="cw-card-icon">
                <Icon size={18} />
              </div>
              <div className="cw-card-copy">
                <p className="cw-label">{title}</p>
                <h3>{value}</h3>
                <p className="cw-muted">{detail}</p>
              </div>
              <div className="cw-score">
                <strong>{score}</strong>
                <span>{scoreLabel}</span>
              </div>
              <ArrowRight size={16} className="cw-card-arrow" />
            </Link>
          ))}
        </div>
      </section>

      <section className="cw-section">
        <div className="cw-section-head">
          <h2 className="cw-section-title">Companion state</h2>
          <span
            className={`cw-chip ${
              companion.sourceTone === 'growth'
                ? 'cw-chip--growth'
                : companion.sourceTone === 'alert'
                  ? 'cw-chip--alert'
                  : 'cw-chip--cool'
            }`}
          >
            <Shield size={14} />
            {companion.sourceLabel}
          </span>
        </div>
        <div className="cw-panel cw-panel--presence">
          <div className="cw-section-head">
            <div>
              <span className="cw-label">
                #{companion.tokenNumber} // Lv.{companion.level}
              </span>
              <h3>{companion.shelterName}</h3>
            </div>
            <span
              className={`cw-chip ${
                companion.statusTone === 'alert'
                  ? 'cw-chip--alert'
                  : companion.statusTone === 'growth'
                    ? 'cw-chip--growth'
                    : 'cw-chip--warm'
              }`}
            >
              <Flame size={14} />
              {companion.statusLabel}
            </span>
          </div>
          <div className="cw-presence-grid">
            {presenceCards.map((card) => (
              <div key={card.label} className="cw-presence-card">
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </div>
            ))}
          </div>
          <p className="cw-muted cw-presence-note">
            Mood, upkeep runway, and immediate focus stay visible here so you can decide what to do next without digging through extra screens.
          </p>
          <div className="cw-meter-list">
            {traits.map((trait) => (
              <div key={trait.label} className="cw-meter-row">
                <div>
                  <span className="cw-label">{trait.label}</span>
                  <div className="cw-meter">
                    <span className={trait.tone} style={{ width: trait.width }} />
                  </div>
                </div>
                <strong>{trait.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <BattleRoyaleActionPanel
        matchId={battleRoyale.matchId}
        status={battleRoyale.status}
        totalPlayers={battleRoyale.totalPlayers}
        triggerCount={battleRoyale.triggerCount}
        pot={battleRoyale.pot}
        participant={battleRoyaleParticipant}
        compact
      />

      <section className="cw-section">
        <div className="cw-section-head">
          <h2 className="cw-section-title">Recent motion</h2>
          <span className="cw-chip cw-chip--growth">
            <Coins size={14} />
            Live summary
          </span>
        </div>
        <div className="cw-list">
          {recentMotion.map((item) => (
            <div key={item.text} className={`cw-list-item ${item.tone}`}>
              <HeartPulse size={16} />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
