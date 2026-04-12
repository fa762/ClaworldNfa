'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Coins,
  Flame,
  Shield,
  Sparkles,
  Swords,
  TimerReset,
} from 'lucide-react';

import { BattleRoyaleActionPanel } from '@/components/game/BattleRoyaleActionPanel';
import { BattleRoyaleClaimPanel } from '@/components/game/BattleRoyaleClaimPanel';
import { OwnedCompanionRail } from '@/components/lobster/OwnedCompanionRail';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useBattleRoyaleClaimWindow } from '@/components/lobster/useBattleRoyaleClaimWindow';
import { useBattleRoyaleOverview } from '@/components/lobster/useBattleRoyaleOverview';
import { useBattleRoyaleParticipantState } from '@/components/lobster/useBattleRoyaleParticipantState';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

export default function CompanionPage() {
  const { pick, t } = useI18n();
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
      label: 'Momentum',
      value:
        companion.taskTotal >= 12
          ? `${companion.taskTotal} tasks`
          : companion.pkWins > 0
            ? `${companion.pkWins} wins`
            : 'Warming up',
    },
  ] as const;

  const traits = [
    { label: 'Courage', value: `${companion.traits.courage}`, width: `${companion.traits.courage}%`, tone: 'cw-meter--growth' },
    { label: 'Wisdom', value: `${companion.traits.wisdom}`, width: `${companion.traits.wisdom}%`, tone: 'cw-meter--cool' },
    { label: 'Social', value: `${companion.traits.social}`, width: `${companion.traits.social}%` },
    { label: 'Create', value: `${companion.traits.create}`, width: `${companion.traits.create}%` },
    { label: 'Grit', value: `${companion.traits.grit}`, width: `${companion.traits.grit}%`, tone: 'cw-meter--growth' },
  ];

  const actionRows = [
    {
      label: t('companion.taskMining'),
      detail: companion.active ? pick('现在可挖', 'Ready now') : pick('需要先补维护', 'Needs upkeep'),
      icon: Sparkles,
      href: '/play',
      score: companion.active ? pick('最佳', 'Best') : pick('等待', 'Wait'),
      scoreLabel: companion.active ? pick('契合', 'fit') : pick('维护', 'upkeep'),
      tone: companion.active ? 'cw-card--ready' : 'cw-card--warning',
    },
    {
      label: 'PK arena',
      detail: `${companion.pkWinRate}% recent win rate`,
      icon: Swords,
      href: '/arena',
      score: `${companion.pkWins}`,
      scoreLabel: 'wins',
      tone: 'cw-card--watch',
    },
    {
      label: 'Battle Royale',
      detail:
        battleRoyaleParticipant.claimable > 0n
          ? `${formatCLW(battleRoyaleParticipant.claimable)} claim ready`
          : battleRoyaleParticipant.entered
            ? `Entered via ${battleRoyaleParticipant.claimPathLabel}`
            : companion.upkeepDays !== null && companion.upkeepDays > 2
              ? 'Reserve allows entry checks'
              : 'Tight reserve window',
      icon: Shield,
      href: '/arena',
      score:
        battleRoyaleParticipant.claimable > 0n
          ? 'Claim'
          : companion.upkeepDays !== null && companion.upkeepDays > 2
            ? 'EV+'
            : 'Tight',
      scoreLabel: battleRoyaleParticipant.claimable > 0n ? 'ready' : 'lobby',
      tone:
        battleRoyaleParticipant.claimable > 0n
          ? 'cw-card--ready'
          : companion.upkeepDays !== null && companion.upkeepDays > 2
            ? 'cw-card--watch'
            : 'cw-card--warning',
    },
    {
      label: 'Autonomy',
      detail: companion.sourceLabel,
      icon: TimerReset,
      href: '/auto',
      score: 'Safe',
      scoreLabel: 'bounded',
      tone: 'cw-card--safe',
    },
  ] as const;

  return (
    <>
      <section className="cw-band">
        <div className="cw-band--split">
          <div>
            <p className="cw-eyebrow">Companion</p>
            <h2 className="cw-section-title">
              {companion.name} // #{companion.tokenNumber}
            </h2>
            <p className="cw-muted">{companion.stance}</p>
          </div>
          <div className="cw-score">
            <strong>Lv.{companion.level}</strong>
            <span>{companion.shelterName}</span>
          </div>
        </div>
      </section>

      <OwnedCompanionRail
        title="Companion roster"
        subtitle="Switch the active lobster here when you want to compare growth, reserve, and arena state."
      />

      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <p className="cw-label">Identity</p>
            <h3>{companion.shelterName}</h3>
            <p className="cw-muted">{companion.sourceLabel}</p>
          </div>
          <span className={`cw-chip ${companion.statusTone === 'alert' ? 'cw-chip--alert' : companion.statusTone === 'growth' ? 'cw-chip--growth' : 'cw-chip--warm'}`}>
            <Flame size={14} />
            {companion.statusLabel}
          </span>
        </div>
        <div className="cw-metrics">
          <div className="cw-metric">
            <span className="cw-label">Wallet Claworld</span>
            <strong>{companion.walletClaworldText}</strong>
          </div>
          <div className="cw-metric">
            <span className="cw-label">Reserve</span>
            <strong>{companion.routerClaworldText}</strong>
          </div>
          <div className="cw-metric">
            <span className="cw-label">Daily upkeep</span>
            <strong>{companion.dailyCostText}</strong>
          </div>
        </div>
      </section>

      <section className="cw-panel cw-panel--presence">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">Presence</span>
            <h3>{companion.name} now reads like a living asset, not a flat stat sheet.</h3>
          </div>
          <span className="cw-chip cw-chip--warm">
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
          Reserve, upkeep runway, and recent action history now all push the companion mood and action bias toward something the user can read in seconds.
        </p>
      </section>

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">Trait shape</span>
            <h3>Live trait values now drive the page.</h3>
          </div>
          <span className={`cw-chip ${companion.sourceTone === 'growth' ? 'cw-chip--growth' : companion.sourceTone === 'alert' ? 'cw-chip--alert' : 'cw-chip--cool'}`}>
            <Shield size={14} />
            {companion.sourceLabel}
          </span>
        </div>
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
      </section>

      <section className="cw-section">
        <div className="cw-section-head">
          <h2 className="cw-section-title">{t('companion.coreLoops')}</h2>
          <span className="cw-chip cw-chip--growth">
            <Coins size={14} />
            {companion.ownedCount} owned
          </span>
        </div>
        <div className="cw-card-stack">
          {actionRows.map(({ label, detail, icon: Icon, href, score, scoreLabel, tone }) => (
            <Link key={label} href={href} className={`cw-card ${tone}`}>
              <div className="cw-card-icon">
                <Icon size={18} />
              </div>
              <div className="cw-card-copy">
                <p className="cw-label">{label}</p>
                <h3>{detail}</h3>
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

      <BattleRoyaleActionPanel
        matchId={battleRoyale.matchId}
        status={battleRoyale.status}
        totalPlayers={battleRoyale.totalPlayers}
        triggerCount={battleRoyale.triggerCount}
        pot={battleRoyale.pot}
        participant={battleRoyaleParticipant}
        compact
      />

      <BattleRoyaleClaimPanel
        matchId={claimWindow.matchId}
        claimable={claimWindow.claimable}
        claimPath={claimWindow.preferredPath?.key}
        hasConflict={claimWindow.hasConflict}
      />

      <section className="cw-panel">
        <p className="cw-label">Readout</p>
        <h3>{companion.taskTotal} total tasks, {companion.pkWins} wins, {companion.pkLosses} losses.</h3>
        <p className="cw-muted">
          This page is now anchored to wallet ownership and on-chain lobster state. The next step is replacing the remaining event placeholders with live modules.
        </p>
      </section>
    </>
  );
}
