'use client';

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
  statusLabel: string;
  statusTone: CompanionStageTone;
  readouts: Array<{ label: string; value: string; tone?: CompanionStageTone }>;
};

function runwayLabel(companion: ReturnType<typeof useActiveCompanion>, pick: <T,>(zh: T, en: T) => T) {
  if (companion.upkeepDays === null) return pick('未知', 'n/a');
  return pick(`${companion.upkeepDays}天`, `${companion.upkeepDays}d`);
}

function getArenaStatus(companion: ReturnType<typeof useActiveCompanion>, pick: <T,>(zh: T, en: T) => T) {
  if (!companion.active) return { label: pick('先维护', 'Upkeep first'), tone: 'alert' as const };
  if (companion.pkWins + companion.pkLosses > 0) {
    return {
      label: `${companion.pkWins}W / ${companion.pkLosses}L`,
      tone: companion.pkWinRate >= 50 ? ('warm' as const) : ('cool' as const),
    };
  }
  return { label: pick('待开赛', 'Ready'), tone: 'cool' as const };
}

function getShellCopy(
  pathname: string,
  companion: ReturnType<typeof useActiveCompanion>,
  pick: <T,>(zh: T, en: T) => T,
  t: (key: string) => string,
): ShellCopy {
  if (pathname.startsWith('/play')) {
    return {
      variant: 'play',
      compact: true,
      eyebrow: `#${companion.tokenNumber} / ${companion.name}`,
      title: pick('任务挖矿', 'Task Mining'),
      statusLabel: companion.active ? pick('可开始', 'Ready') : companion.statusLabel,
      statusTone: companion.active ? 'growth' : companion.statusTone,
      readouts: [
        { label: pick('储备', 'Reserve'), value: companion.routerClaworldText, tone: 'warm' },
        { label: pick('续航', 'Runway'), value: runwayLabel(companion, pick), tone: companion.statusTone },
        { label: pick('任务', 'Tasks'), value: `${companion.taskTotal}`, tone: 'growth' },
      ],
    };
  }

  if (pathname.startsWith('/arena')) {
    const arenaStatus = getArenaStatus(companion, pick);
    return {
      variant: 'arena',
      compact: true,
      eyebrow: `#${companion.tokenNumber} / ${companion.name}`,
      title: pick('竞技', 'Arena'),
      statusLabel: arenaStatus.label,
      statusTone: arenaStatus.tone,
      readouts: [
        { label: 'PK', value: `${companion.pkWinRate}%`, tone: arenaStatus.tone },
        { label: pick('胜场', 'Wins'), value: `${companion.pkWins}`, tone: 'warm' },
        { label: pick('储备', 'Reserve'), value: companion.routerClaworldText, tone: 'cool' },
      ],
    };
  }

  if (pathname.startsWith('/auto')) {
    return {
      variant: 'auto',
      compact: true,
      eyebrow: `#${companion.tokenNumber} / ${companion.name}`,
      title: pick('代理', 'Auto'),
      statusLabel: pick('受控', 'Bounded'),
      statusTone: 'cool',
      readouts: [
        { label: pick('维护', 'Upkeep'), value: companion.dailyCostText, tone: 'growth' },
        { label: pick('续航', 'Runway'), value: runwayLabel(companion, pick), tone: companion.statusTone },
        { label: pick('来源', 'Source'), value: companion.sourceLabel, tone: companion.sourceTone },
      ],
    };
  }

  if (pathname.startsWith('/settings')) {
    return {
      variant: 'settings',
      compact: true,
      eyebrow: pick('系统', 'System'),
      title: pick('设置', 'Settings'),
      statusLabel: companion.connected ? pick('已连接', 'Connected') : pick('未连接', 'Offline'),
      statusTone: companion.connected ? 'cool' : 'alert',
      readouts: [
        { label: pick('持有', 'Owned'), value: `${companion.ownedCount}`, tone: 'cool' },
        { label: pick('钱包', 'Wallet'), value: companion.walletClaworldText, tone: 'warm' },
        { label: pick('状态', 'Status'), value: companion.statusLabel, tone: companion.statusTone },
      ],
    };
  }

  return {
    variant: 'home',
    compact: false,
    eyebrow: `#${companion.tokenNumber} / ${companion.shelterName}`,
    title: `${companion.name} / Lv.${companion.level}`,
    statusLabel: companion.statusLabel,
    statusTone: companion.statusTone,
    readouts: [
      { label: pick('钱包', 'Wallet'), value: companion.walletClaworldText, tone: 'growth' },
      { label: pick('储备', 'Reserve'), value: companion.routerClaworldText, tone: 'warm' },
      { label: pick('续航', 'Runway'), value: runwayLabel(companion, pick), tone: companion.statusTone },
    ],
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const companion = useActiveCompanion();
  const { t, pick, lang, setLang } = useI18n();
  const shellCopy = getShellCopy(pathname, companion, pick, t);

  return (
    <div className="cw-shell">
      <div className={`cw-screen cw-screen--${shellCopy.variant}`}>
        <header className="cw-topbar">
          <div className="cw-topbar-brand">
            <p className="cw-overline">Mobile dApp</p>
            <h1 className="cw-brand">Clawworld</h1>
          </div>
          <div className="cw-top-actions">
            {companion.ownedCount > 1 ? (
              <div className="cw-switcher" aria-label={t('shell.selector')}>
                <button
                  type="button"
                  className="cw-switcher-btn"
                  onClick={companion.selectPrevious}
                  aria-label={t('shell.previous')}
                  disabled={companion.isLoading}
                >
                  <ChevronLeft size={14} />
                </button>
                <div className="cw-switcher-label">
                  <strong>#{companion.tokenNumber || '--'}</strong>
                  <span>
                    {companion.isLoading
                      ? pick('同步中', 'Syncing')
                      : `${companion.selectedIndex + 1}/${companion.ownedCount}`}
                  </span>
                </div>
                <button
                  type="button"
                  className="cw-switcher-btn"
                  onClick={companion.selectNext}
                  aria-label={t('shell.next')}
                  disabled={companion.isLoading}
                >
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
          </div>
        </header>

        <CompanionStage
          compact={shellCopy.compact}
          variant={shellCopy.variant}
          eyebrow={shellCopy.eyebrow}
          title={shellCopy.title}
          statusLabel={shellCopy.statusLabel}
          statusTone={shellCopy.statusTone}
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
