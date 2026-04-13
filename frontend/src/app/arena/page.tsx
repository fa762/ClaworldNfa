'use client';

import { useState } from 'react';
import { RefreshCw, Shield, Swords, Trophy } from 'lucide-react';

import { BattleRoyaleActionPanel } from '@/components/game/BattleRoyaleActionPanel';
import { BattleRoyaleClaimPanel } from '@/components/game/BattleRoyaleClaimPanel';
import { PKArenaPanel } from '@/components/game/PKArenaPanel';
import { OwnedCompanionRail } from '@/components/lobster/OwnedCompanionRail';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useBattleRoyaleClaimWindow } from '@/components/lobster/useBattleRoyaleClaimWindow';
import { useBattleRoyaleOverview } from '@/components/lobster/useBattleRoyaleOverview';
import { useBattleRoyaleParticipantState } from '@/components/lobster/useBattleRoyaleParticipantState';
import { WalletGate } from '@/components/wallet/WalletGate';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

function getMatchStatusText(status: number, pick: <T,>(zh: T, en: T) => T) {
  if (status === 0) return pick('开放中', 'Open');
  if (status === 1) return pick('待 reveal', 'Pending reveal');
  if (status === 2) return pick('已结算', 'Settled');
  return pick('未知', 'Unknown');
}

export default function ArenaPage() {
  const { pick } = useI18n();
  const companion = useActiveCompanion();
  const battleRoyale = useBattleRoyaleOverview();
  const [refreshingMatch, setRefreshingMatch] = useState(false);
  const battleRoyaleParticipant = useBattleRoyaleParticipantState(
    battleRoyale.matchId,
    companion.hasToken ? companion.tokenId : undefined,
    companion.ownerAddress,
  );
  const claimWindow = useBattleRoyaleClaimWindow(
    companion.hasToken ? companion.tokenId : undefined,
    companion.ownerAddress,
  );

  const totalPk = companion.pkWins + companion.pkLosses;
  const battleRoyaleLoading = battleRoyale.isLoading;

  async function handleRefreshMatch() {
    setRefreshingMatch(true);
    try {
      await battleRoyale.refresh();
    } finally {
      setRefreshingMatch(false);
    }
  }

  const pkCard = {
    title: pick('PK 竞技', 'PK Arena'),
    status:
      totalPk > 0
        ? `${companion.pkWins}W / ${companion.pkLosses}L`
        : pick('还没有已结算 PK', 'No settled PK yet'),
    detail:
      totalPk > 0
        ? pick(
            `最近 PK 胜率 ${companion.pkWinRate}%。`,
            `${companion.pkWinRate}% win rate across recent PK history.`,
          )
        : pick(
            'PK 链路已经可用，但这只龙虾还没有已结算 PK 记录。',
            'The PK surface is ready, but this lobster has no settled PK record yet.',
          ),
    score: totalPk > 0 ? `${companion.pkWinRate}%` : pick('冷启动', 'Cold'),
    scoreLabel: totalPk > 0 ? pick('胜率', 'win rate') : pick('记录', 'history'),
    icon: Swords,
    tone: totalPk > 0 && companion.pkWinRate >= 50 ? 'cw-card--watch' : 'cw-card--safe',
  } as const;

  const battleRoyaleStatus = battleRoyale.ready
    ? getMatchStatusText(battleRoyale.status, pick)
    : pick('未找到对局', 'No match found');

  const battleRoyaleCard = {
    title:
      claimWindow.claimable > 0n
        ? pick('Battle Royale 领取', 'Battle Royale claim')
        : 'Battle Royale',
    status: claimWindow.claimable > 0n
      ? pick(
          `第 #${claimWindow.matchId?.toString() ?? '-'} 场已结算`,
          `Match #${claimWindow.matchId?.toString() ?? '-'} settled`,
        )
      : battleRoyale.hasError
        ? pick('对局读取失败', 'Match read failed')
        : battleRoyale.ready
          ? pick(
              `第 #${battleRoyale.matchId?.toString()} 场 ${battleRoyaleStatus}`,
              `Match #${battleRoyale.matchId?.toString()} ${battleRoyaleStatus}`,
            )
          : pick('等待对局数据', 'Waiting for match data'),
    detail: battleRoyale.ready
      ? `${battleRoyale.totalPlayers}/${battleRoyale.triggerCount} ${pick('人', 'players')} / ${pick('奖池', 'pot')} ${formatCLW(battleRoyale.pot)} / ${pick('最低', 'min')} ${formatCLW(battleRoyale.minStake)}${
          claimWindow.claimable > 0n
            ? pick(` / 可领 ${formatCLW(claimWindow.claimable)}`, ` / settled claim ${formatCLW(claimWindow.claimable)}`)
            : battleRoyaleParticipant.claimable > 0n
              ? pick(` / 可领 ${formatCLW(battleRoyaleParticipant.claimable)}`, ` / claim ${formatCLW(battleRoyaleParticipant.claimable)}`)
              : battleRoyaleParticipant.entered
                ? pick(` / 已通过 ${battleRoyaleParticipant.claimPathLabel} 入场`, ` / entered via ${battleRoyaleParticipant.claimPathLabel}`)
                : ''
        }`
      : battleRoyale.hasError
        ? pick(
            `合约读取出错，可在这里直接重试。${battleRoyale.errorText ? ` / ${battleRoyale.errorText}` : ''}`,
            `Contract read failed. Retry from this surface.${battleRoyale.errorText ? ` / ${battleRoyale.errorText}` : ''}`,
          )
        : pick(
            '最新对局和场上数据会从合约里加载到这里。',
            'The latest match and field data will load here from the contract.',
          ),
    score: battleRoyale.ready ? `${battleRoyale.totalPlayers}/${battleRoyale.triggerCount}` : '--',
    scoreLabel: battleRoyale.ready ? pick('人数', 'players') : pick('场上', 'field'),
    icon: Trophy,
    tone:
      claimWindow.claimable > 0n || battleRoyaleParticipant.claimable > 0n
        ? 'cw-card--ready'
        : battleRoyale.ready && battleRoyale.status === 0
          ? 'cw-card--warning'
          : battleRoyale.ready && battleRoyale.status === 1
            ? 'cw-card--watch'
            : battleRoyale.hasError
              ? 'cw-card--warning'
              : 'cw-card--safe',
  } as const;

  const pkPosture = totalPk > 0 ? companion.pkWinRate : companion.traits.courage;
  const brPressure =
    battleRoyale.ready && battleRoyale.triggerCount > 0
      ? Math.min(100, Math.round((battleRoyale.totalPlayers / battleRoyale.triggerCount) * 100))
      : 0;
  const PkCardIcon = pkCard.icon;
  const BattleRoyaleCardIcon = battleRoyaleCard.icon;

  return (
    <>
      <section className="cw-band">
        <div className="cw-band--split">
          <div>
            <p className="cw-eyebrow">{pick('竞技中心', 'Arena hub')}</p>
            <h2 className="cw-section-title">
              {pick(
                `${companion.name} 现在能看到更清晰的场上状态。`,
                `${companion.name} enters with clearer field state.`,
              )}
            </h2>
            <p className="cw-muted">
              {pick(
                'PK 和 Battle Royale 现在都走真实对局状态、receipt 感知动作和 owner/autonomy 边界，不再是占位文案。',
                'PK and Battle Royale now expose real match state, receipt-aware actions, and owner/autonomy boundaries instead of placeholder copy.',
              )}
            </p>
          </div>
          <div className="cw-score">
            <strong>{battleRoyale.ready ? getMatchStatusText(battleRoyale.status, pick) : pick('实时', 'Live')}</strong>
            <span>{pick('竞技状态', 'arena state')}</span>
          </div>
        </div>
      </section>

      <WalletGate
        title={pick('先连接 owner 钱包，再打开竞技链路。', 'Connect the owner wallet before opening arena flows.')}
        detail={pick(
          'PK 和 Battle Royale 都需要真实所有权、储备和 participant-path 检查。钱包离线时不该继续渲染死数据。',
          'PK and Battle Royale need real ownership, reserve, and participant-path checks. Arena should not keep rendering dead placeholders when the wallet is offline.',
        )}
      >
        <OwnedCompanionRail
          title={pick('竞技编组', 'Arena roster')}
          subtitle={pick(
            '在做 PK 或 Battle Royale 决策前，先切换当前龙虾。',
            'Switch the active lobster here before committing to PK or Battle Royale decisions.',
          )}
        />

        <section className="cw-card-stack">
          <article className={`cw-card ${pkCard.tone}`}>
            <div className="cw-card-icon">
              <PkCardIcon size={18} />
            </div>
            <div className="cw-card-copy">
              <p className="cw-label">{pkCard.title}</p>
              <h3>{pkCard.status}</h3>
              <p className="cw-muted">{pkCard.detail}</p>
            </div>
            <div className="cw-score">
              <strong>{pkCard.score}</strong>
              <span>{pkCard.scoreLabel}</span>
            </div>
          </article>

          {battleRoyaleLoading ? (
            <div className="cw-skeleton-block cw-skeleton-block--card" />
          ) : (
            <article className={`cw-card ${battleRoyaleCard.tone}`}>
              <div className="cw-card-icon">
                <BattleRoyaleCardIcon size={18} />
              </div>
              <div className="cw-card-copy">
                <p className="cw-label">{battleRoyaleCard.title}</p>
                <h3>{battleRoyaleCard.status}</h3>
                <p className="cw-muted">{battleRoyaleCard.detail}</p>
              </div>
              <div className="cw-score">
                <strong>{battleRoyaleCard.score}</strong>
                <span>{battleRoyaleCard.scoreLabel}</span>
              </div>
            </article>
          )}
        </section>

        {battleRoyaleLoading ? (
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
        ) : battleRoyale.hasError || !battleRoyale.ready ? (
          <section className="cw-panel cw-panel--cool">
            <div className="cw-section-head">
              <div>
                <span className="cw-label">{pick('对局刷新', 'Match refresh')}</span>
                <h3>
                  {battleRoyale.hasError
                    ? pick('Battle Royale 读取失败，现在可以在这里重试。', 'Battle Royale reads failed. Retry from here.')
                    : pick('还没读到对局，可以手动再拉取一次。', 'No match is readable yet. Pull the contract state again from here.')}
                </h3>
                <p className="cw-muted">
                  {battleRoyale.hasError
                    ? battleRoyale.errorText ?? pick('最新合约读取没有过，先刷新一次试试。', 'The latest contract read failed. Refresh once from the page first.')
                    : pick(
                        '竞技页面现在有内建的 contract refresh，不用整页重刷。',
                        'Arena now has an in-page contract refresh, so a full page reload is not required.',
                      )}
                </p>
              </div>
              <button
                type="button"
                className="cw-button cw-button--secondary"
                onClick={() => void handleRefreshMatch()}
                disabled={refreshingMatch || battleRoyale.isRefreshing}
              >
                <RefreshCw size={16} />
                {refreshingMatch || battleRoyale.isRefreshing
                  ? pick('刷新中', 'Refreshing')
                  : pick('刷新对局', 'Refresh match')}
              </button>
            </div>
          </section>
        ) : null}

        <PKArenaPanel
          tokenId={companion.hasToken ? companion.tokenId : undefined}
          ownerAddress={companion.ownerAddress}
          companionName={companion.name}
          reserve={companion.routerClaworld}
          reserveText={companion.routerClaworldText}
          level={companion.level}
          traits={companion.traits}
        />

        {battleRoyaleLoading ? (
          <>
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
            <section className="cw-panel cw-panel--cool">
              <div className="cw-loading-card">
                <div className="cw-skeleton-line cw-skeleton-line--short" />
                <div className="cw-skeleton-line" />
                <div className="cw-skeleton-line cw-skeleton-line--mid" />
                <div className="cw-skeleton-line" />
              </div>
            </section>
          </>
        ) : (
          <>
            <BattleRoyaleActionPanel
              matchId={battleRoyale.matchId}
              status={battleRoyale.status}
              totalPlayers={battleRoyale.totalPlayers}
              triggerCount={battleRoyale.triggerCount}
              pot={battleRoyale.pot}
              participant={battleRoyaleParticipant}
            />

            <BattleRoyaleClaimPanel
              matchId={claimWindow.matchId}
              claimable={claimWindow.claimable}
              claimPath={claimWindow.preferredPath?.key}
              hasConflict={claimWindow.hasConflict}
            />

            <section className="cw-panel cw-panel--cool">
              <div className="cw-section-head">
                <div>
                  <span className="cw-label">{pick('场上读数', 'Field read')}</span>
                  <h3>{pick('竞技入口现在会同时反映战绩、对局状态和 participant 路径。', 'The arena now reflects record, match state, and participant path.')}</h3>
                </div>
                <span className="cw-chip cw-chip--cool">
                  <Shield size={14} />
                  {pick('实时读取', 'Live read')}
                </span>
              </div>
              <div className="cw-meter-list">
                <div className="cw-meter-row">
                  <div>
                    <span className="cw-label">{pick('PK 姿态', 'PK posture')}</span>
                    <div className="cw-meter">
                      <span className={pkPosture >= 50 ? 'cw-meter--growth' : 'cw-meter--cool'} style={{ width: `${pkPosture}%` }} />
                    </div>
                  </div>
                  <strong>
                    {totalPk > 0
                      ? pick(`${companion.pkWinRate}% 胜率`, `${companion.pkWinRate}% win rate`)
                      : pick(`${companion.traits.courage} 勇气`, `${companion.traits.courage} courage`)}
                  </strong>
                </div>
                <div className="cw-meter-row">
                  <div>
                    <span className="cw-label">{pick('BR 压力', 'BR pressure')}</span>
                    <div className="cw-meter">
                      <span
                        className={
                          claimWindow.claimable > 0n || battleRoyaleParticipant.claimable > 0n
                            ? 'cw-meter--growth'
                            : battleRoyale.status === 0
                              ? 'cw-meter--growth'
                              : 'cw-meter--cool'
                        }
                        style={{ width: `${brPressure}%` }}
                      />
                    </div>
                  </div>
                  <strong>
                    {claimWindow.claimable > 0n
                      ? pick(
                          `可领 ${formatCLW(claimWindow.claimable)} / ${claimWindow.preferredPath?.key === 'autonomy' ? '自治 participant' : 'owner 钱包'}`,
                          `Claim ${formatCLW(claimWindow.claimable)} via ${claimWindow.preferredPath?.key === 'autonomy' ? 'autonomy participant' : 'owner wallet'}`,
                        )
                      : battleRoyaleParticipant.claimable > 0n
                        ? pick(
                            `可领 ${formatCLW(battleRoyaleParticipant.claimable)} / ${battleRoyaleParticipant.claimPathLabel}`,
                            `Claim ${formatCLW(battleRoyaleParticipant.claimable)} via ${battleRoyaleParticipant.claimPathLabel}`,
                          )
                        : battleRoyaleParticipant.entered
                          ? pick(
                              `已通过 ${battleRoyaleParticipant.claimPathLabel} 入场 / 房间 ${battleRoyaleParticipant.preferredPath?.roomId ?? 0}`,
                              `Entered via ${battleRoyaleParticipant.claimPathLabel} / room ${battleRoyaleParticipant.preferredPath?.roomId ?? 0}`,
                            )
                          : battleRoyale.ready
                            ? pick(
                                `${battleRoyale.totalPlayers}/${battleRoyale.triggerCount} 个席位 / 第 ${battleRoyale.roundId.toString()} 轮`,
                                `${battleRoyale.totalPlayers}/${battleRoyale.triggerCount} seats / round ${battleRoyale.roundId.toString()}`,
                              )
                            : pick('等待对局', 'Waiting for match')}
                  </strong>
                </div>
              </div>
            </section>

            <section className="cw-list">
              <div className="cw-list-item cw-list-item--warm">
                <Trophy size={16} />
                <span>
                  {battleRoyale.ready
                    ? pick(
                        `第 #${battleRoyale.matchId?.toString()} 场奖池 ${formatCLW(battleRoyale.pot)}，reveal 延迟 ${battleRoyale.revealDelay} 个区块。`,
                        `Match #${battleRoyale.matchId?.toString()} pot ${formatCLW(battleRoyale.pot)} with reveal delay ${battleRoyale.revealDelay} blocks.`,
                      )
                    : pick(
                        '暂时没从合约里读到最近一场 Battle Royale。',
                        'No recent Battle Royale match was readable from the contract.',
                      )}
                </span>
              </div>
              <div className="cw-list-item cw-list-item--cool">
                <Shield size={16} />
                <span>
                  {battleRoyaleParticipant.hasConflict
                    ? pick(
                        'owner 和 autonomy participant 两条路径都像是有效状态，claim 之前要先人工确认。',
                        'Both owner and autonomy participant paths look populated. This needs explicit review before surfacing a claim action.',
                      )
                    : battleRoyale.ready && battleRoyale.leadingRoom.room > 0
                      ? pick(
                          `当前领先房间是 ${battleRoyale.leadingRoom.room}，总 stake ${battleRoyale.leadingRoom.total}。`,
                          `Leading room is ${battleRoyale.leadingRoom.room} with total stake ${battleRoyale.leadingRoom.total}.`,
                        )
                      : pick(
                          '等当前对局 snapshot 可读后，房间总量会显示在这里。',
                          'Room totals will appear once the current match snapshot is readable.',
                        )}
                </span>
              </div>
            </section>
          </>
        )}
      </WalletGate>
    </>
  );
}
