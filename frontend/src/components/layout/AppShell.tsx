'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Globe2 } from 'lucide-react';

import { BottomTabs } from './BottomTabs';
import { PwaStatusBanner } from './PwaStatusBanner';
import { CompanionStage, type CompanionStageTone, type CompanionStageVariant } from '@/components/lobster/CompanionStage';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useI18n } from '@/lib/i18n';

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

function getCompanionMood(companion: ReturnType<typeof useActiveCompanion>, t: (k: string) => string) {
  if (!companion.connected) return { label: t('mood.dormant'), tone: 'cool' as const };
  if (!companion.hasToken) return { label: t('mood.searching'), tone: 'alert' as const };
  if (!companion.active) return { label: t('mood.hungry'), tone: 'alert' as const };
  if (companion.upkeepDays !== null && companion.upkeepDays <= 1) return { label: t('mood.restless'), tone: 'alert' as const };
  if (companion.pkWinRate >= 60) return { label: t('mood.firedUp'), tone: 'warm' as const };
  if (companion.taskTotal >= 10) return { label: t('mood.settled'), tone: 'growth' as const };
  return { label: t('mood.attentive'), tone: 'growth' as const };
}

function runwayLabel(companion: ReturnType<typeof useActiveCompanion>) {
  if (companion.upkeepDays === null) return 'n/a';
  return `${companion.upkeepDays}d`;
}

function getShellCopy(pathname: string, companion: ReturnType<typeof useActiveCompanion>, t: (k: string) => string): ShellCopy {
  const mood = getCompanionMood(companion, t);

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
        { label: `${t('shell.wallet')} ${companion.walletClaworldText}`, tone: 'growth' },
        { label: `${t('shell.reserve')} ${companion.routerClaworldText}`, tone: 'warm' },
      ],
      moodLabel: mood.label,
      moodTone: mood.tone,
      readouts: [
        { label: t('shell.reserve'), value: companion.routerClaworldText, tone: 'warm' },
        { label: t('shell.runway'), value: runwayLabel(companion), tone: companion.statusTone },
        { label: t('shell.tasks'), value: `${companion.taskTotal}`, tone: 'growth' },
      ],
      cta: { href: '/companion', label: t('shell.openCompanion') },
    };
  }

  if (pathname.startsWith('/play')) {
    return {
      variant: 'play',
      compact: true,
      eyebrow: t('shell.taskQueue'),
      title: `${companion.name} // ${t('shell.play')}`,
      subtitle: '',
      statusLabel: companion.active ? t('status.alive') : companion.statusLabel,
      statusTone: companion.active ? 'growth' : companion.statusTone,
      signals: [
        { label: `${companion.taskTotal} ${t('shell.tasks')}`, tone: 'growth' },
        { label: `${t('shell.reserve')} ${companion.routerClaworldText}`, tone: 'warm' },
        { label: t('shell.lowGasPath'), tone: 'cool' },
      ],
      moodLabel: companion.active ? t('mood.working') : mood.label,
      moodTone: companion.active ? 'growth' : mood.tone,
      readouts: [
        { label: t('shell.reserve'), value: companion.routerClaworldText, tone: 'warm' },
        { label: t('shell.runway'), value: runwayLabel(companion), tone: companion.statusTone },
        { label: t('shell.loop'), value: `${companion.taskTotal}`, tone: 'growth' },
      ],
      cta: { href: '/play', label: t('shell.taskQueue') },
    };
  }

  if (pathname.startsWith('/arena')) {
    const arenaStatusLabel =
      companion.pkWins + companion.pkLosses > 0
        ? `${companion.pkWins}W / ${companion.pkLosses}L`
        : t('mood.fieldLive');
    const arenaStatusTone =
      companion.pkWins + companion.pkLosses > 0
        ? companion.pkWinRate >= 50 ? ('warm' as const) : ('alert' as const)
        : ('alert' as const);

    return {
      variant: 'arena',
      compact: true,
      eyebrow: t('shell.arenaHub'),
      title: `${companion.name} // ${t('shell.arena')}`,
      subtitle: '',
      statusLabel: arenaStatusLabel,
      statusTone: arenaStatusTone,
      signals: [
        { label: `${companion.pkWinRate}% ${t('shell.pk')}`, tone: companion.pkWinRate >= 50 ? 'growth' : 'alert' },
        { label: t('shell.brWarming'), tone: 'alert' },
        { label: t('shell.revealTracked'), tone: 'cool' },
      ],
      moodLabel: companion.pkWinRate >= 50 ? t('mood.aggressive') : mood.label,
      moodTone: companion.pkWinRate >= 50 ? 'warm' : mood.tone,
      readouts: [
        { label: t('shell.pk'), value: `${companion.pkWinRate}%`, tone: companion.pkWinRate >= 50 ? 'growth' : 'alert' },
        { label: t('shell.wins'), value: `${companion.pkWins}`, tone: 'warm' },
        { label: t('shell.reserve'), value: companion.routerClaworldText, tone: 'cool' },
      ],
      cta: { href: '/arena', label: t('shell.arenaHub') },
    };
  }

  if (pathname.startsWith('/auto')) {
    return {
      variant: 'auto',
      compact: true,
      eyebrow: t('shell.autonomy'),
      title: `${companion.name} // ${t('shell.auto')}`,
      subtitle: '',
      statusLabel: 'Dry-run',
      statusTone: 'cool',
      signals: [
        { label: `${companion.dailyCostText} ${t('shell.upkeep')}`, tone: 'growth' },
        { label: t('shell.directiveSynced'), tone: 'cool' },
        { label: t('shell.policyLocked'), tone: 'warm' },
      ],
      moodLabel: t('mood.bounded'),
      moodTone: 'cool',
      readouts: [
        { label: t('shell.upkeep'), value: companion.dailyCostText, tone: 'growth' },
        { label: t('shell.runway'), value: runwayLabel(companion), tone: companion.statusTone },
        { label: t('shell.source'), value: companion.sourceLabel, tone: companion.sourceTone },
      ],
      cta: { href: '/auto', label: t('shell.autonomy') },
    };
  }

  if (pathname.startsWith('/settings')) {
    return {
      variant: 'settings',
      compact: true,
      eyebrow: t('shell.settings'),
      title: t('mood.quietControls'),
      subtitle: '',
      statusLabel: t('mood.stable'),
      statusTone: 'cool',
      signals: [
        { label: companion.connected ? t('mood.walletLinked') : t('mood.walletOffline'), tone: companion.connected ? 'growth' : 'alert' },
        { label: t('shell.alertsConfigurable') },
      ],
      moodLabel: companion.connected ? t('mood.stable') : t('mood.offline'),
      moodTone: companion.connected ? 'cool' : 'alert',
      readouts: [
        { label: t('shell.owned'), value: `${companion.ownedCount}`, tone: 'cool' },
        { label: t('shell.reserve'), value: companion.routerClaworldText, tone: 'warm' },
        { label: t('shell.status'), value: companion.statusLabel, tone: companion.statusTone },
      ],
      cta: { href: '/settings', label: t('shell.settings') },
    };
  }

  return {
    variant: 'companion',
    compact: true,
    eyebrow: companion.shelterName,
    title: `${companion.name} // Lv.${companion.level}`,
    subtitle: '',
    statusLabel: companion.statusLabel,
    statusTone: companion.statusTone,
    signals: [
      { label: `${companion.ownedCount} ${t('shell.owned')}`, tone: 'cool' },
      { label: `${companion.taskTotal} ${t('shell.tasks')}`, tone: 'growth' },
      { label: `${t('shell.reserve')} ${companion.routerClaworldText}`, tone: 'warm' },
    ],
    moodLabel: mood.label,
    moodTone: mood.tone,
    readouts: [
      { label: t('shell.reserve'), value: companion.routerClaworldText, tone: 'warm' },
      { label: t('shell.tasks'), value: `${companion.taskTotal}`, tone: 'growth' },
      { label: t('shell.pk'), value: `${companion.pkWins}-${companion.pkLosses}`, tone: companion.pkWinRate >= 50 ? 'growth' : 'cool' },
    ],
    cta: { href: '/', label: t('nav.home') },
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const companion = useActiveCompanion();
  const { t, pick, lang, setLang } = useI18n();
  const shellCopy = getShellCopy(pathname, companion, t);

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
              <div className="cw-switcher" aria-label={t('shell.selector')}>
                <button type="button" className="cw-switcher-btn" onClick={companion.selectPrevious} aria-label={t('shell.previous')} disabled={companion.isLoading}>
                  <ChevronLeft size={14} />
                </button>
                <div className="cw-switcher-label">
                  {companion.isLoading ? (
                    <>
                      <strong>{t('loading')}</strong>
                      <span>{pick('同步链上状态', 'Syncing on-chain state')}</span>
                    </>
                  ) : (
                    <>
                      <strong>{companion.name}</strong>
                      <span>
                        #{companion.tokenNumber} / {companion.selectedIndex + 1} of {companion.ownedCount}
                      </span>
                    </>
                  )}
                </div>
                <button type="button" className="cw-switcher-btn" onClick={companion.selectNext} aria-label={t('shell.next')} disabled={companion.isLoading}>
                  <ChevronRight size={14} />
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className="cw-toplink cw-toplink--lang"
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              aria-label={lang === 'zh' ? t('shell.switchToEnglish') : t('shell.switchToChinese')}
            >
              <Globe2 size={14} />
              {lang === 'zh' ? 'EN' : '中'}
            </button>
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
          imageSrc={companion.imageSrc}
          imageAlt={companion.imageAlt}
          loading={companion.isLoading}
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
