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
import { CompanionUpkeepPanel } from '@/components/lobster/CompanionUpkeepPanel';
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
      label: pick('状态', 'Mood'),
      value:
        !companion.connected ? pick('休眠', 'Dormant')
        : !companion.active ? pick('饥饿', 'Hungry')
        : companion.upkeepDays !== null && companion.upkeepDays <= 1 ? pick('躁动', 'Restless')
        : companion.pkWinRate >= 60 ? pick('战意高涨', 'Fired up')
        : companion.taskTotal >= 10 ? pick('沉稳', 'Settled')
        : pick('专注', 'Attentive'),
    },
    {
      label: pick('续航', 'Runway'),
      value: companion.upkeepDays === null ? 'n/a' : pick(`${companion.upkeepDays} 天`, `${companion.upkeepDays} days`),
    },
    {
      label: pick('动能', 'Momentum'),
      value:
        companion.taskTotal >= 12
          ? pick(`${companion.taskTotal} 次挖矿`, `${companion.taskTotal} tasks`)
          : companion.pkWins > 0
            ? pick(`${companion.pkWins} 胜`, `${companion.pkWins} wins`)
            : pick('刚开始热身', 'Warming up'),
    },
  ] as const;

  const traits = [
    { label: pick('勇气', 'Courage'), value: `${companion.traits.courage}`, width: `${companion.traits.courage}%`, tone: 'cw-meter--growth' },
    { label: pick('智慧', 'Wisdom'), value: `${companion.traits.wisdom}`, width: `${companion.traits.wisdom}%`, tone: 'cw-meter--cool' },
    { label: pick('社交', 'Social'), value: `${companion.traits.social}`, width: `${companion.traits.social}%` },
    { label: pick('创造', 'Create'), value: `${companion.traits.create}`, width: `${companion.traits.create}%` },
    { label: pick('韧性', 'Grit'), value: `${companion.traits.grit}`, width: `${companion.traits.grit}%`, tone: 'cw-meter--growth' },
  ];

  const actionRows = [
    {
      label: t('companion.taskMining'),
      detail: companion.active ? pick('现在可挖', 'Ready now') : pick('需要先补维护', 'Needs upkeep'),
      icon: Sparkles,
      href: '/play',
      score: companion.active ? pick('最优', 'Best') : pick('等待', 'Wait'),
      scoreLabel: companion.active ? pick('契合', 'fit') : pick('维护', 'upkeep'),
      tone: companion.active ? 'cw-card--ready' : 'cw-card--warning',
    },
    {
      label: 'PK Arena',
      detail: pick(`最近 PK 胜率 ${companion.pkWinRate}%`, `${companion.pkWinRate}% recent win rate`),
      icon: Swords,
      href: '/arena',
      score: `${companion.pkWins}`,
      scoreLabel: pick('胜场', 'wins'),
      tone: 'cw-card--watch',
    },
    {
      label: 'Battle Royale',
      detail:
        battleRoyaleParticipant.claimable > 0n
          ? pick(`${formatCLW(battleRoyaleParticipant.claimable)} 可领取`, `${formatCLW(battleRoyaleParticipant.claimable)} claim ready`)
          : battleRoyaleParticipant.entered
            ? pick(`已通过 ${battleRoyaleParticipant.claimPathLabel} 入场`, `Entered via ${battleRoyaleParticipant.claimPathLabel}`)
            : companion.upkeepDays !== null && companion.upkeepDays > 2
              ? pick('储备允许继续评估入场', 'Reserve allows entry checks')
              : pick('当前储备偏紧', 'Tight reserve window'),
      icon: Shield,
      href: '/arena',
      score:
        battleRoyaleParticipant.claimable > 0n
          ? pick('领取', 'Claim')
          : companion.upkeepDays !== null && companion.upkeepDays > 2
            ? 'EV+'
            : pick('偏紧', 'Tight'),
      scoreLabel: battleRoyaleParticipant.claimable > 0n ? pick('就绪', 'ready') : pick('大厅', 'lobby'),
      tone:
        battleRoyaleParticipant.claimable > 0n
          ? 'cw-card--ready'
          : companion.upkeepDays !== null && companion.upkeepDays > 2
            ? 'cw-card--watch'
            : 'cw-card--warning',
    },
    {
      label: pick('自治代理', 'Autonomy'),
      detail: companion.sourceLabel,
      icon: TimerReset,
      href: '/auto',
      score: pick('受控', 'Safe'),
      scoreLabel: pick('边界', 'bounded'),
      tone: 'cw-card--safe',
    },
  ] as const;

  return (
    <>
      <section className="cw-band">
        <div className="cw-band--split">
          <div>
            <p className="cw-eyebrow">{pick('伙伴', 'Companion')}</p>
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
        title={pick('伙伴编组', 'Companion roster')}
        subtitle={pick('切换当前龙虾，对比成长、储备和竞技状态。', 'Switch the active lobster here when you want to compare growth, reserve, and arena state.')}
      />

      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <p className="cw-label">{pick('身份', 'Identity')}</p>
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
            <span className="cw-label">{pick('钱包 Claworld', 'Wallet Claworld')}</span>
            <strong>{companion.walletClaworldText}</strong>
          </div>
          <div className="cw-metric">
            <span className="cw-label">{pick('储备', 'Reserve')}</span>
            <strong>{companion.routerClaworldText}</strong>
          </div>
          <div className="cw-metric">
            <span className="cw-label">{pick('日维护', 'Daily upkeep')}</span>
            <strong>{companion.dailyCostText}</strong>
          </div>
        </div>
      </section>

      <section className="cw-panel cw-panel--presence">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('存在感', 'Presence')}</span>
            <h3>{pick(`${companion.name} 应该看起来像一只活着的伙伴。`, `${companion.name} should read like a living companion.`)}</h3>
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
          {pick('储备、续航和最近的行为会一起推着它的状态变化，而且用户应该一眼看懂。', 'Reserve, upkeep runway, and recent behavior should make the current state readable at a glance.')}
        </p>
      </section>

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('性格轮廓', 'Trait shape')}</span>
            <h3>{pick('当前页面已经由真实 trait 数值驱动。', 'Live trait values now drive the page.')}</h3>
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

      <CompanionUpkeepPanel
        tokenId={companion.tokenId}
        ownerAddress={companion.ownerAddress}
        reserve={companion.routerClaworld}
        dailyCost={companion.dailyCost}
        upkeepDays={companion.upkeepDays}
      />

      <section className="cw-section">
        <div className="cw-section-head">
          <h2 className="cw-section-title">{t('companion.coreLoops')}</h2>
          <span className="cw-chip cw-chip--growth">
            <Coins size={14} />
            {pick(`${companion.ownedCount} 只`, `${companion.ownedCount} owned`)}
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
        <p className="cw-label">{pick('总读数', 'Readout')}</p>
        <h3>{pick(`总共 ${companion.taskTotal} 次挖矿，PK ${companion.pkWins} 胜 ${companion.pkLosses} 负。`, `${companion.taskTotal} total tasks, ${companion.pkWins} wins, ${companion.pkLosses} losses.`)}</h3>
        <p className="cw-muted">
          {pick('成长、维护和竞技读数现在都收在这一页，不用再回旧详情页找关键入口。', 'This page now keeps growth, upkeep, and arena readouts together so the critical controls stay in one place.')}
        </p>
      </section>
    </>
  );
}
