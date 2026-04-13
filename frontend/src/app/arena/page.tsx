'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Shield, Swords, Trophy, X } from 'lucide-react';

import { BattleRoyaleActionPanel } from '@/components/game/BattleRoyaleActionPanel';
import { BattleRoyaleClaimPanel } from '@/components/game/BattleRoyaleClaimPanel';
import { PKArenaPanel } from '@/components/game/PKArenaPanel';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useBattleRoyaleClaimWindow } from '@/components/lobster/useBattleRoyaleClaimWindow';
import { useBattleRoyaleOverview } from '@/components/lobster/useBattleRoyaleOverview';
import { useBattleRoyaleParticipantState } from '@/components/lobster/useBattleRoyaleParticipantState';
import { WalletGate } from '@/components/wallet/WalletGate';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type ArenaSheet = 'pk' | 'br' | null;

function getMatchStatusText(status: number, pick: <T,>(zh: T, en: T) => T) {
  if (status === 0) return pick('开放中', 'Open');
  if (status === 1) return pick('待揭示', 'Pending reveal');
  if (status === 2) return pick('已结算', 'Settled');
  return pick('未知', 'Unknown');
}

export default function ArenaPage() {
  const { pick } = useI18n();
  const companion = useActiveCompanion();
  const [sheet, setSheet] = useState<ArenaSheet>(null);
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

  const claimableAmount = useMemo(
    () => (claimWindow.claimable > 0n ? claimWindow.claimable : battleRoyaleParticipant.claimable),
    [battleRoyaleParticipant.claimable, claimWindow.claimable],
  );

  const pkSummary = companion.pkWins + companion.pkLosses > 0
    ? `${companion.pkWins}W / ${companion.pkLosses}L`
    : pick('立即开打', 'Open a match');

  const brSummary = claimableAmount > 0n
    ? pick(`可领 ${formatCLW(claimableAmount)}`, `Claim ${formatCLW(claimableAmount)}`)
    : battleRoyale.ready
      ? `${getMatchStatusText(battleRoyale.status, pick)} / ${battleRoyale.totalPlayers}/${battleRoyale.triggerCount}`
      : pick('查看大逃杀', 'Open Battle Royale');

  return (
    <WalletGate
      title={pick('先连接持有人钱包', 'Connect owner wallet first')}
      detail={pick('连接后才能进入竞技。', 'Connect before entering the arena.')}
    >
      <section className="cw-card-stack">
        <button
          type="button"
          className={`cw-card cw-card--button cw-card--watch ${sheet === 'pk' ? 'cw-card--selected' : ''}`}
          onClick={() => setSheet('pk')}
        >
          <div className="cw-card-icon">
            <Swords size={18} />
          </div>
          <div className="cw-card-copy">
            <p className="cw-label">PK</p>
            <h3>{pkSummary}</h3>
          </div>
          <div className="cw-score">
            <strong>{companion.pkWinRate}%</strong>
            <span>{pick('进入', 'Open')}</span>
          </div>
        </button>

        <button
          type="button"
          className={`cw-card cw-card--button cw-card--warm ${sheet === 'br' ? 'cw-card--selected' : ''}`}
          onClick={() => setSheet('br')}
        >
          <div className="cw-card-icon">
            <Trophy size={18} />
          </div>
          <div className="cw-card-copy">
            <p className="cw-label">{pick('大逃杀', 'Battle Royale')}</p>
            <h3>{brSummary}</h3>
          </div>
          <div className="cw-score">
            <strong>{battleRoyale.ready ? formatCLW(battleRoyale.pot) : '--'}</strong>
            <span>{pick('进入', 'Open')}</span>
          </div>
        </button>
      </section>

      {sheet !== null ? (
        <section className="cw-modal" aria-modal="true" role="dialog">
          <button
            type="button"
            className="cw-modal__scrim"
            aria-label={pick('关闭', 'Close')}
            onClick={() => setSheet(null)}
          />
          <div className="cw-modal__sheet">
            <section className="cw-sheet">
              <div className="cw-sheet-head">
                <div>
                  <span className="cw-label">{sheet === 'pk' ? 'PK' : pick('大逃杀', 'Battle Royale')}</span>
                  <h3>{sheet === 'pk' ? pick('选择动作', 'Choose action') : pick('查看赛况', 'Review match')}</h3>
                </div>
                <button
                  type="button"
                  className="cw-icon-button cw-sheet-close"
                  onClick={() => setSheet(null)}
                  aria-label={pick('关闭', 'Close')}
                >
                  <X size={16} />
                </button>
              </div>

              {sheet === 'pk' ? (
                <PKArenaPanel
                  tokenId={companion.hasToken ? companion.tokenId : undefined}
                  ownerAddress={companion.ownerAddress}
                  companionName={companion.name}
                  reserve={companion.routerClaworld}
                  reserveText={companion.routerClaworldText}
                  level={companion.level}
                  traits={companion.traits}
                />
              ) : (
                <div className="cw-page">
                  <section className="cw-panel cw-panel--warm">
                    <div className="cw-section-head">
                      <div>
                        <span className="cw-label">{pick('大逃杀', 'Battle Royale')}</span>
                        <h3>
                          {battleRoyale.ready
                            ? pick(
                                `第 #${battleRoyale.matchId?.toString()} 场 ${getMatchStatusText(battleRoyale.status, pick)}`,
                                `Match #${battleRoyale.matchId?.toString()} ${getMatchStatusText(battleRoyale.status, pick)}`,
                              )
                            : pick('暂无可读对局', 'No readable match')}
                        </h3>
                      </div>
                      <span className="cw-chip cw-chip--warm">
                        <Trophy size={14} />
                        {battleRoyale.ready ? `${battleRoyale.totalPlayers}/${battleRoyale.triggerCount}` : '--'}
                      </span>
                    </div>

                    {battleRoyale.ready ? (
                      <div className="cw-state-grid">
                        <div className="cw-state-card">
                          <span className="cw-label">{pick('奖池', 'Pot')}</span>
                          <strong>{formatCLW(battleRoyale.pot)}</strong>
                        </div>
                        <div className="cw-state-card">
                          <span className="cw-label">{pick('门票', 'Stake')}</span>
                          <strong>{formatCLW(battleRoyale.minStake)}</strong>
                        </div>
                        <div className="cw-state-card">
                          <span className="cw-label">{pick('待领', 'Claim')}</span>
                          <strong>{claimableAmount > 0n ? formatCLW(claimableAmount) : '--'}</strong>
                        </div>
                      </div>
                    ) : null}
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
                </div>
              )}

              <div className="cw-button-row">
                <button type="button" className="cw-button cw-button--ghost" onClick={() => setSheet(null)}>
                  <ArrowRight size={16} />
                  {pick('关闭', 'Close')}
                </button>
              </div>
            </section>
          </div>
        </section>
      ) : null}
    </WalletGate>
  );
}
