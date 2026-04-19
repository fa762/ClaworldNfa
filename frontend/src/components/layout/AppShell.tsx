'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Compass, Globe2 } from 'lucide-react';

import { BottomTabs } from './BottomTabs';
import { PwaStatusBanner } from './PwaStatusBanner';
import { CompanionDetailsSheet } from '@/components/lobster/CompanionDetailsSheet';
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

function runwayLabel(companion: ReturnType<typeof useActiveCompanion>) {
  if (companion.upkeepDays === null) return 'n/a';
  return `${companion.upkeepDays}天`;
}

function getArenaStatus(companion: ReturnType<typeof useActiveCompanion>) {
  if (!companion.active) return { label: '先维护', tone: 'alert' as const };
  if (companion.pkWins + companion.pkLosses > 0) {
    return {
      label: `${companion.pkWins}胜 / ${companion.pkLosses}败`,
      tone: companion.pkWinRate >= 50 ? ('warm' as const) : ('cool' as const),
    };
  }
  return { label: '当前空闲', tone: 'cool' as const };
}

function getShellCopy(pathname: string, companion: ReturnType<typeof useActiveCompanion>, pick: <T,>(zh: T, en: T) => T): ShellCopy {
  if (pathname.startsWith('/play')) {
    return {
      variant: 'play',
      compact: true,
      eyebrow: `#${companion.tokenNumber} / ${companion.name}`,
      title: '任务挖矿',
      statusLabel: companion.active ? '可开始' : companion.statusLabel,
      statusTone: companion.active ? 'growth' : companion.statusTone,
      readouts: [
        { label: '储备', value: companion.routerClaworldText, tone: 'warm' },
        { label: '续航', value: runwayLabel(companion), tone: companion.statusTone },
        { label: '任务', value: `${companion.taskTotal}`, tone: 'growth' },
      ],
    };
  }

  if (pathname.startsWith('/arena')) {
    const arenaStatus = getArenaStatus(companion);
    return {
      variant: 'arena',
      compact: true,
      eyebrow: `#${companion.tokenNumber} / ${companion.name}`,
      title: '竞技',
      statusLabel: arenaStatus.label,
      statusTone: arenaStatus.tone,
      readouts: [
        { label: '胜率', value: `${companion.pkWinRate}%`, tone: arenaStatus.tone },
        { label: '胜败', value: `${companion.pkWins}胜 / ${companion.pkLosses}败`, tone: 'warm' },
        { label: '储备', value: companion.routerClaworldText, tone: 'cool' },
      ],
    };
  }

  if (pathname.startsWith('/auto')) {
    return {
      variant: 'auto',
      compact: true,
      eyebrow: `#${companion.tokenNumber} / ${companion.name}`,
      title: '代理',
      statusLabel: '受控策略',
      statusTone: 'cool',
      readouts: [
        { label: '储备', value: companion.routerClaworldText, tone: 'warm' },
        { label: '维护', value: companion.dailyCostText, tone: 'growth' },
        { label: '续航', value: runwayLabel(companion), tone: companion.statusTone },
      ],
    };
  }

  if (pathname.startsWith('/settings')) {
    return {
      variant: 'settings',
      compact: true,
      eyebrow: '系统',
      title: '设置',
      statusLabel: companion.connected ? '已连接' : '离线',
      statusTone: companion.connected ? 'cool' : 'alert',
      readouts: [
        { label: '持有', value: `${companion.ownedCount}`, tone: 'cool' },
        { label: '储备', value: companion.routerClaworldText, tone: 'warm' },
        { label: '状态', value: companion.statusLabel, tone: companion.statusTone },
      ],
    };
  }

  if (pathname.startsWith('/mint')) {
    return {
      variant: 'home',
      compact: true,
      eyebrow: pick('创世铸造', 'Genesis Mint'),
      title: '铸造',
      statusLabel: companion.connected ? '可铸造' : '先连钱包',
      statusTone: companion.connected ? 'warm' : 'cool',
      readouts: [
        { label: '储备', value: companion.routerClaworldText, tone: 'warm' },
        { label: '维护', value: companion.dailyCostText, tone: 'cool' },
        { label: '续航', value: runwayLabel(companion), tone: companion.statusTone },
      ],
    };
  }

  return {
    variant: 'home',
    compact: true,
    eyebrow: `#${companion.tokenNumber} / ${companion.shelterName}`,
    title: `${companion.name} / Lv.${companion.level}`,
    statusLabel: companion.statusLabel,
    statusTone: companion.statusTone,
    readouts: [
      { label: '储备', value: companion.routerClaworldText, tone: 'warm' },
      { label: '维护', value: companion.dailyCostText, tone: 'cool' },
      { label: '续航', value: runwayLabel(companion), tone: companion.statusTone },
    ],
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const companion = useActiveCompanion();
  const { t, pick, lang, setLang } = useI18n();
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (pathname === '/') {
    return <>{children}</>;
  }

  const shellCopy = getShellCopy(pathname, companion, pick);
  const showMintShortcut = pathname === '/';

  return (
    <div className="cw-shell">
      <div className={`cw-screen cw-screen--${shellCopy.variant}`}>
        <header className="cw-topbar">
          <div className="cw-topbar-brand">
            <p className="cw-overline">{pick('移动端 DApp', 'Mobile Dapp')}</p>
            <h1 className="cw-brand">{pick('龙虾世界', 'Clawworld')}</h1>
          </div>
          <div className="cw-top-actions">
            {showMintShortcut ? (
              <Link href="/mint" className="cw-toplink cw-toplink--mint" aria-label="前往铸造">
                <Compass size={14} />
                {pick('铸造', 'Mint')}
              </Link>
            ) : null}
            {companion.ownedCount > 1 ? (
              <div className="cw-switcher" aria-label={t('shell.selector')}>
                <button type="button" className="cw-switcher-btn" onClick={companion.selectPrevious} aria-label={t('shell.previous')} disabled={companion.isLoading}>
                  <ChevronLeft size={14} />
                </button>
                <div className="cw-switcher-label">
                  <strong>#{companion.tokenNumber || '--'}</strong>
                  <span>{companion.isLoading ? pick('同步中', 'Syncing') : `${companion.selectedIndex + 1}/${companion.ownedCount}`}</span>
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
          </div>
        </header>

        <button
          type="button"
          className="cw-stage-trigger"
          onClick={() => setDetailsOpen(true)}
          aria-label={pick('打开伙伴详情', 'Open companion details')}
        >
          <CompanionStage
            compact={shellCopy.compact}
            variant={shellCopy.variant}
            eyebrow={shellCopy.eyebrow}
            title={shellCopy.title}
            statusLabel={shellCopy.statusLabel}
            statusTone={shellCopy.statusTone}
            readouts={shellCopy.readouts}
            loading={companion.isLoading}
          />
        </button>

        <PwaStatusBanner />

        <main className="cw-main">
          <div className="cw-page">{children}</div>
        </main>

        <BottomTabs />
      </div>

      <CompanionDetailsSheet companion={companion} open={detailsOpen} onClose={() => setDetailsOpen(false)} />
    </div>
  );
}
