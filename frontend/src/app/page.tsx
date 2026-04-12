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
import { useI18n } from '@/lib/i18n';

function receiptStatusText(status: number, pick: <T,>(zh: T, en: T) => T) {
  if (status === 4) return pick('已执行', 'Executed');
  if (status === 5) return pick('失败', 'Failed');
  if (status === 3) return pick('已终结', 'Finalized');
  if (status === 2) return pick('已同步', 'Synced');
  if (status === 1) return pick('已履约', 'Fulfilled');
  return pick('等待中', 'Pending');
}

function matchStatusText(status: number, pick: <T,>(zh: T, en: T) => T) {
  if (status === 0) return pick('开放中', 'Open');
  if (status === 1) return pick('待 reveal', 'Pending reveal');
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
      title: pick('任务挖矿', 'Task Mining'),
      value: companion.active
        ? pick(`${companion.name} 现在可挖`, `${companion.name} can work now`)
        : pick('先补维护', 'Needs upkeep first'),
      detail: companion.active
        ? pick(
            `储备 ${companion.routerClaworldText}，已经累计 ${companion.taskTotal} 次挖矿。`,
            `Reserve ${companion.routerClaworldText}. ${companion.taskTotal} tasks already logged.`,
          )
        : pick('先把维护续航补起来，再开下一轮挖矿。', 'Top up upkeep runway before starting another mining run.'),
      icon: Sparkles,
      href: '/play',
      score: companion.active ? pick('现在', 'Now') : pick('等待', 'Wait'),
      scoreLabel: companion.active ? pick('最优', 'best fit') : pick('维护', 'upkeep'),
      tone: companion.active ? 'cw-card--ready' : 'cw-card--warning',
    },
    {
      title: pick('竞技观察', 'Arena Watch'),
      value: battleRoyale.ready
        ? claimWindow.claimable > 0n
          ? pick(`第 #${claimWindow.matchId?.toString() ?? '-'} 场可领取`, `Claim ready from match #${claimWindow.matchId?.toString() ?? '-'}`)
          : pick(
              `第 #${battleRoyale.matchId?.toString()} 场 ${matchStatusText(battleRoyale.status, pick)}`,
              `Match #${battleRoyale.matchId?.toString()} ${matchStatusText(battleRoyale.status, pick)}`,
            )
        : pick(`PK 胜率 ${companion.pkWinRate}%`, `${companion.pkWinRate}% PK win rate`),
      detail: battleRoyale.ready
        ? `${battleRoyale.totalPlayers}/${battleRoyale.triggerCount} ${pick('人', 'players')} / ${pick('奖池', 'pot')} ${formatCLW(battleRoyale.pot)}${
            claimWindow.claimable > 0n
              ? pick(` / 可领 ${formatCLW(claimWindow.claimable)}`, ` / settled claim ${formatCLW(claimWindow.claimable)}`)
              : battleRoyaleParticipant.claimable > 0n
                ? pick(` / 可领 ${formatCLW(battleRoyaleParticipant.claimable)}`, ` / claim ${formatCLW(battleRoyaleParticipant.claimable)}`)
                : battleRoyaleParticipant.entered
                  ? pick(` / 已通过 ${battleRoyaleParticipant.claimPathLabel} 入场`, ` / entered via ${battleRoyaleParticipant.claimPathLabel}`)
                  : ''
          }`
        : pick('Battle Royale 和 PK 都收在同一个竞技入口里。', 'Battle Royale and PK remain grouped under one competitive surface.'),
      icon: Swords,
      href: '/arena',
      score: battleRoyale.ready ? `${battleRoyale.totalPlayers}/${battleRoyale.triggerCount}` : pick('观察', 'Watch'),
      scoreLabel: battleRoyale.ready ? pick('人数', 'players') : pick('活动', 'event live'),
      tone:
        claimWindow.claimable > 0n || battleRoyaleParticipant.claimable > 0n
          ? 'cw-card--ready'
          : battleRoyale.ready && battleRoyale.status === 0
            ? 'cw-card--warning'
            : 'cw-card--watch',
    },
    {
      title: pick('自治代理', 'Autonomy'),
      value: latestReceipt
        ? pick(
            `请求 #${latestReceipt.requestId?.toString() ?? '-'} ${receiptStatusText(Number(latestReceipt.status ?? 0), pick)}`,
            `Req #${latestReceipt.requestId?.toString() ?? '-'} ${receiptStatusText(Number(latestReceipt.status ?? 0), pick)}`,
          )
        : companion.sourceLabel,
      detail: latestReceipt
        ? pick(
            `花费 ${formatCLW(BigInt(latestReceipt.actualSpend ?? 0n))} / credit ${formatCLW(BigInt(latestReceipt.clwCredit ?? 0n))}`,
            `Spend ${formatCLW(BigInt(latestReceipt.actualSpend ?? 0n))} / credit ${formatCLW(BigInt(latestReceipt.clwCredit ?? 0n))}`,
          )
        : pick('directive、预算和 proof 都留在受控边界里。', 'Directive, budget, and proof surfaces stay inside the bounded control path.'),
      icon: TimerReset,
      href: '/auto',
      score: proofs.ledger ? `${proofs.ledger.executedCount}` : pick('受控', 'Bounded'),
      scoreLabel: proofs.ledger ? pick('已执行', 'executed') : pick('策略', 'policy'),
      tone: latestReceipt && Number(latestReceipt.status ?? 0) === 5 ? 'cw-card--warning' : 'cw-card--safe',
    },
  ] as const;

  const traits = [
    { label: pick('勇气', 'Courage'), value: `${companion.traits.courage}`, width: `${companion.traits.courage}%` },
    {
      label: pick('智慧', 'Wisdom'),
      value: `${companion.traits.wisdom}`,
      width: `${companion.traits.wisdom}%`,
      tone: 'cw-meter--cool',
    },
    {
      label: pick('韧性', 'Grit'),
      value: `${companion.traits.grit}`,
      width: `${companion.traits.grit}%`,
      tone: 'cw-meter--growth',
    },
  ];

  const recentMotion = [
    {
      tone: 'cw-list-item--warm',
      text: `${pick('钱包 Claworld', 'Wallet Claworld')}: ${companion.walletClaworldText}`,
    },
    {
      tone: 'cw-list-item--cool',
      text:
        companion.upkeepDays === null
          ? pick('当前无法读取维护续航。', 'Upkeep runway not available')
          : pick(
              `按当前储备还能跑 ${companion.upkeepDays} 天维护。`,
              `Upkeep runway: ${companion.upkeepDays} days at current reserve`,
            ),
    },
    {
      tone: battleRoyale.ready ? 'cw-list-item--warm' : 'cw-list-item--cool',
      text: battleRoyale.ready
        ? pick(
            `Battle Royale #${battleRoyale.matchId?.toString()} 当前 ${matchStatusText(battleRoyale.status, pick)}，人数 ${battleRoyale.totalPlayers}/${battleRoyale.triggerCount}。`,
            `Battle Royale #${battleRoyale.matchId?.toString()} is ${matchStatusText(battleRoyale.status, pick)} with ${battleRoyale.totalPlayers}/${battleRoyale.triggerCount} players.`,
          )
        : pick('暂时没从合约里读到 Battle Royale 摘要。', 'No live Battle Royale match summary was readable from the contract.'),
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
        ? pick(
            `已结算可领取：第 #${claimWindow.matchId?.toString() ?? '-'} 场，金额 ${formatCLW(claimWindow.claimable)}。`,
            `Settled Battle Royale claimable: ${formatCLW(claimWindow.claimable)} in match #${claimWindow.matchId?.toString() ?? '-'}.`,
          )
        : battleRoyaleParticipant.claimable > 0n
          ? pick(
              `Battle Royale 可领取：${formatCLW(battleRoyaleParticipant.claimable)}，路径 ${battleRoyaleParticipant.claimPathLabel}。`,
              `Battle Royale claimable: ${formatCLW(battleRoyaleParticipant.claimable)} via ${battleRoyaleParticipant.claimPathLabel}.`,
            )
          : battleRoyaleParticipant.entered
            ? pick(`当前参赛路径：${battleRoyaleParticipant.claimPathLabel}。`, `Current match participation is tracked via ${battleRoyaleParticipant.claimPathLabel}.`)
            : latestReceipt
              ? pick(
                  `最新自治回执：#${latestReceipt.requestId?.toString() ?? '-'} ${receiptStatusText(Number(latestReceipt.status ?? 0), pick)}${latestReceipt.lastError ? ` / ${latestReceipt.lastError}` : ''}`,
                  `Latest autonomy receipt: #${latestReceipt.requestId?.toString() ?? '-'} ${receiptStatusText(Number(latestReceipt.status ?? 0), pick)}${latestReceipt.lastError ? ` / ${latestReceipt.lastError}` : ''}`,
                )
              : pick('当前龙虾还没有可见的 Battle Royale 自治回执。', 'No recent Battle Royale autonomy receipt is visible for the active lobster.'),
    },
  ];

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
      label: pick('重点', 'Focus'),
      value: claimWindow.claimable > 0n ? pick('领取', 'Claim') : companion.active ? pick('挖矿', 'Task') : pick('维护', 'Upkeep'),
    },
  ] as const;

  return (
    <>
      <section className="cw-band">
        <div className="cw-band--split">
          <div>
            <p className="cw-eyebrow">{pick('今日', 'Today')}</p>
            <h2 className="cw-section-title">{pick(`${companion.name} 是当前主角。`, `${companion.name} is the center of the loop.`)}</h2>
            <p className="cw-muted">{companion.stance}</p>
          </div>
          <div className="cw-score">
            <strong>{companion.routerClaworldText}</strong>
            <span>{pick('储备', 'reserve')}</span>
          </div>
        </div>
        <div className="cw-metrics">
          <div className="cw-metric">
            <span className="cw-label">{pick('钱包 Claworld', 'Wallet Claworld')}</span>
            <strong>{companion.walletClaworldText}</strong>
          </div>
          <div className="cw-metric">
            <span className="cw-label">{pick('持有 NFA', 'Owned NFAs')}</span>
            <strong>{companion.ownedCount}</strong>
          </div>
          <div className="cw-metric">
            <span className="cw-label">{pick('日维护', 'Daily upkeep')}</span>
            <strong>{companion.dailyCostText}</strong>
          </div>
        </div>
      </section>

      <OwnedCompanionRail
        title={pick('已拥有编组', 'Owned roster')}
        subtitle={pick('不用离开当前页面，直接切换驱动实时读数的龙虾。', 'Keep the same page open while switching which lobster drives the live reads.')}
      />

      {companion.isLoading && companion.connected && companion.hasToken ? (
        <section className="cw-panel cw-panel--cool">
          <div className="cw-loading-card">
            <div className="cw-skeleton-line cw-skeleton-line--short" />
            <div className="cw-skeleton-line" />
            <div className="cw-skeleton-grid">
              <div className="cw-skeleton-block" />
              <div className="cw-skeleton-block" />
              <div className="cw-skeleton-block" />
            </div>
          </div>
        </section>
      ) : null}

      {companion.connected && !companion.hasToken ? (
        <section className="cw-panel cw-panel--cool">
          <div className="cw-section-head">
            <div>
              <span className="cw-label">{pick('还没有龙虾', 'No companion yet')}</span>
              <h3>{pick('这个钱包已经连上，但还没有拥有龙虾。', 'This wallet is live, but it does not own a lobster yet.')}</h3>
              <p className="cw-muted">
                {pick('先去铸造一只，首页才能切到真实的储备、维护、挖矿和竞技状态。', 'Mint one first so Home can switch from demo posture into real reserve, upkeep, mining, and arena state.')}
              </p>
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
          <h2 className="cw-section-title">{pick('下一步', 'Next moves')}</h2>
          <Link href="/companion" className="cw-inline-link">
            {pick('伙伴页', 'Companion view')} <ArrowRight size={14} />
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
          <h2 className="cw-section-title">{pick('伙伴状态', 'Companion state')}</h2>
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
            {pick('状态、维护续航和眼前重点都放在这里，不用翻很多层页面再决定下一步。', 'Mood, upkeep runway, and immediate focus stay visible here so you can decide what to do next without digging through extra screens.')}
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
          <h2 className="cw-section-title">{pick('最近动态', 'Recent motion')}</h2>
          <span className="cw-chip cw-chip--growth">
            <Coins size={14} />
            {pick('实时摘要', 'Live summary')}
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
