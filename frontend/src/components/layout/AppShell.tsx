'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { BottomTabs } from './BottomTabs';
import { PwaStatusBanner } from './PwaStatusBanner';
import { CompanionStage, type CompanionStageTone, type CompanionStageVariant } from '@/components/lobster/CompanionStage';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';

type ShellCopy = {
  variant: CompanionStageVariant;
  compact: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  statusTone: CompanionStageTone;
  signals: Array<{ label: string; tone?: CompanionStageTone }>;
  moodLabel: string;
  moodTone: CompanionStageTone;
  readouts: Array<{ label: string; value: string; tone?: CompanionStageTone }>;
  cta: { href: string; label: string };
};

function getCompanionMood(companion: ReturnType<typeof useActiveCompanion>) {
  if (!companion.connected) return { label: 'Dormant', tone: 'cool' as const };
  if (!companion.hasToken) return { label: 'Searching', tone: 'alert' as const };
  if (!companion.active) return { label: 'Hungry', tone: 'alert' as const };
  if (companion.upkeepDays !== null && companion.upkeepDays <= 1) return { label: 'Restless', tone: 'alert' as const };
  if (companion.pkWinRate >= 60) return { label: 'Fired up', tone: 'warm' as const };
  if (companion.taskTotal >= 10) return { label: 'Settled', tone: 'growth' as const };
  return { label: 'Attentive', tone: 'growth' as const };
}

function runwayLabel(companion: ReturnType<typeof useActiveCompanion>) {
  if (companion.upkeepDays === null) return 'n/a';
  return `${companion.upkeepDays}d`;
}

function getShellCopy(pathname: string, companion: ReturnType<typeof useActiveCompanion>): ShellCopy {
  const mood = getCompanionMood(companion);

  if (pathname === '/') {
    return {
      variant: 'home',
      compact: false,
      eyebrow: companion.shelterName,
      title: `${companion.name} // Lv.${companion.level}`,
      subtitle: companion.stance,
      statusLabel: companion.statusLabel,
      statusTone: companion.statusTone,
      signals: [
        { label: companion.sourceLabel, tone: companion.sourceTone },
        { label: `Wallet ${companion.walletClaworldText}`, tone: 'growth' },
        { label: `Reserve ${companion.routerClaworldText}`, tone: 'warm' },
      ],
      moodLabel: mood.label,
      moodTone: mood.tone,
      readouts: [
        { label: 'Reserve', value: companion.routerClaworldText, tone: 'warm' },
        { label: 'Runway', value: runwayLabel(companion), tone: companion.statusTone },
        { label: 'Tasks', value: `${companion.taskTotal}`, tone: 'growth' },
      ],
      cta: { href: '/companion', label: 'Open Companion' },
    };
  }

  if (pathname.startsWith('/play')) {
    return {
      variant: 'play',
      compact: true,
      eyebrow: 'Task Loop',
      title: `${companion.name} Ready To Work`,
      subtitle: 'Pick the next action with the best return and the least hesitation.',
      statusLabel: companion.active ? 'Cooldown open' : companion.statusLabel,
      statusTone: companion.active ? 'growth' : companion.statusTone,
      signals: [
        { label: `${companion.taskTotal} tasks logged`, tone: 'growth' },
        { label: `Reserve ${companion.routerClaworldText}`, tone: 'warm' },
        { label: 'Low gas path', tone: 'cool' },
      ],
      moodLabel: companion.active ? 'Working' : mood.label,
      moodTone: companion.active ? 'growth' : mood.tone,
      readouts: [
        { label: 'Reserve', value: companion.routerClaworldText, tone: 'warm' },
        { label: 'Runway', value: runwayLabel(companion), tone: companion.statusTone },
        { label: 'Loop', value: `${companion.taskTotal} tasks`, tone: 'growth' },
      ],
      cta: { href: '/play', label: 'Task Queue' },
    };
  }

  if (pathname.startsWith('/arena')) {
    const arenaStatusLabel =
      companion.pkWins + companion.pkLosses > 0
        ? `${companion.pkWins}W / ${companion.pkLosses}L`
        : 'Field live';
    const arenaStatusTone =
      companion.pkWins + companion.pkLosses > 0
        ? companion.pkWinRate >= 50
          ? ('warm' as const)
          : ('alert' as const)
        : ('alert' as const);

    return {
      variant: 'arena',
      compact: true,
      eyebrow: 'Arena Readiness',
      title: `${companion.name} In The Arena`,
      subtitle: 'PK and Battle Royale stay close, with risk and timing visible before entry.',
      statusLabel: arenaStatusLabel,
      statusTone: arenaStatusTone,
      signals: [
        { label: `${companion.pkWinRate}% PK win rate`, tone: companion.pkWinRate >= 50 ? 'growth' : 'alert' },
        { label: 'BR warming', tone: 'alert' },
        { label: 'Reveal tracked', tone: 'cool' },
      ],
      moodLabel: companion.pkWinRate >= 50 ? 'Aggressive' : mood.label,
      moodTone: companion.pkWinRate >= 50 ? 'warm' : mood.tone,
      readouts: [
        { label: 'PK', value: `${companion.pkWinRate}%`, tone: companion.pkWinRate >= 50 ? 'growth' : 'alert' },
        { label: 'Wins', value: `${companion.pkWins}`, tone: 'warm' },
        { label: 'Reserve', value: companion.routerClaworldText, tone: 'cool' },
      ],
      cta: { href: '/arena', label: 'Arena Hub' },
    };
  }

  if (pathname.startsWith('/auto')) {
    return {
      variant: 'auto',
      compact: true,
      eyebrow: 'Autonomy Boundaries',
      title: `${companion.name} On Boundaries`,
      subtitle: 'Policies, budgets, directives, and recent actions live on one controlled surface.',
      statusLabel: 'Dry-run',
      statusTone: 'cool',
      signals: [
        { label: `${companion.dailyCostText} daily upkeep`, tone: 'growth' },
        { label: 'Directive synced', tone: 'cool' },
        { label: 'Policy locked', tone: 'warm' },
      ],
      moodLabel: 'Bounded',
      moodTone: 'cool',
      readouts: [
        { label: 'Upkeep', value: companion.dailyCostText, tone: 'growth' },
        { label: 'Runway', value: runwayLabel(companion), tone: companion.statusTone },
        { label: 'Source', value: companion.sourceLabel, tone: companion.sourceTone },
      ],
      cta: { href: '/auto', label: 'Autonomy' },
    };
  }

  if (pathname.startsWith('/settings')) {
    return {
      variant: 'settings',
      compact: true,
      eyebrow: 'Companion Settings',
      title: 'Quiet Controls',
      subtitle: 'Wallet, AI, notifications, and advanced modes belong behind a calm surface.',
      statusLabel: 'Stable',
      statusTone: 'cool',
      signals: [
        { label: 'Wallet linked', tone: 'cool' },
        { label: companion.connected ? 'Wallet linked' : 'Wallet not linked', tone: companion.connected ? 'growth' : 'alert' },
        { label: 'Alerts configurable' },
      ],
      moodLabel: companion.connected ? 'Stable' : 'Offline',
      moodTone: companion.connected ? 'cool' : 'alert',
      readouts: [
        { label: 'Owned', value: `${companion.ownedCount}`, tone: 'cool' },
        { label: 'Reserve', value: companion.routerClaworldText, tone: 'warm' },
        { label: 'Status', value: companion.statusLabel, tone: companion.statusTone },
      ],
      cta: { href: '/settings', label: 'Settings' },
    };
  }

  return {
    variant: 'companion',
    compact: true,
    eyebrow: companion.shelterName,
    title: `${companion.name} // Lv.${companion.level}`,
    subtitle: 'Identity, growth, and action should all read from one living center.',
    statusLabel: companion.statusLabel,
    statusTone: companion.statusTone,
    signals: [
      { label: `${companion.ownedCount} owned`, tone: 'cool' },
      { label: `${companion.taskTotal} tasks`, tone: 'growth' },
      { label: `Reserve ${companion.routerClaworldText}`, tone: 'warm' },
    ],
    moodLabel: mood.label,
    moodTone: mood.tone,
    readouts: [
      { label: 'Reserve', value: companion.routerClaworldText, tone: 'warm' },
      { label: 'Tasks', value: `${companion.taskTotal}`, tone: 'growth' },
      { label: 'PK', value: `${companion.pkWins}-${companion.pkLosses}`, tone: companion.pkWinRate >= 50 ? 'growth' : 'cool' },
    ],
    cta: { href: '/', label: 'Home' },
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const companion = useActiveCompanion();
  const shellCopy = getShellCopy(pathname, companion);

  return (
    <div className="cw-shell">
      <div className={`cw-screen cw-screen--${shellCopy.variant}`}>
        <header className="cw-topbar">
          <div>
            <p className="cw-overline">Clawworld</p>
            <h1 className="cw-brand">Lobster Companion</h1>
          </div>
          <div className="cw-top-actions">
            {companion.ownedCount > 1 ? (
              <div className="cw-switcher" aria-label="Active lobster selector">
                <button type="button" className="cw-switcher-btn" onClick={companion.selectPrevious} aria-label="Previous lobster">
                  <ChevronLeft size={14} />
                </button>
                <div className="cw-switcher-label">
                  <strong>{companion.name}</strong>
                  <span>
                    #{companion.tokenNumber} / {companion.selectedIndex + 1} of {companion.ownedCount}
                  </span>
                </div>
                <button type="button" className="cw-switcher-btn" onClick={companion.selectNext} aria-label="Next lobster">
                  <ChevronRight size={14} />
                </button>
              </div>
            ) : null}
            <Link href={shellCopy.cta.href} className="cw-toplink">
              {shellCopy.cta.label}
            </Link>
          </div>
        </header>

        <CompanionStage
          compact={shellCopy.compact}
          variant={shellCopy.variant}
          eyebrow={shellCopy.eyebrow}
          title={shellCopy.title}
          subtitle={shellCopy.subtitle}
          statusLabel={shellCopy.statusLabel}
          statusTone={shellCopy.statusTone}
          signals={shellCopy.signals}
          moodLabel={shellCopy.moodLabel}
          moodTone={shellCopy.moodTone}
          readouts={shellCopy.readouts}
        />

        <PwaStatusBanner />

        <main className="cw-main">
          <div className="cw-page">{children}</div>
        </main>

        <BottomTabs />
      </div>
    </div>
  );
}
