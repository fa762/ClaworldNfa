'use client';

import { useState } from 'react';
import { Shield, Swords, Trophy } from 'lucide-react';

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

type ArenaMode = 'pk' | 'br';

function getMatchStatusText(status: number, pick: <T,>(zh: T, en: T) => T) {
  if (status === 0) return pick('开放中', 'Open');
  if (status === 1) return pick('待揭示', 'Pending reveal');
  if (status === 2) return pick('已结算', 'Settled');
  return pick('未知', 'Unknown');
}

export default function ArenaPage() {
  const { pick } = useI18n();
  const companion = useActiveCompanion();
  const [mode, setMode] = useState<ArenaMode>('pk');
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

  return (
    <>
      <WalletGate
        title={pick('先连接持有人钱包', 'Connect owner wallet first')}
        detail={pick('连接后才能进竞技场。', 'Connect before entering the arena.')}
      >
        <section className="cw-segmented">
          <button
            type="button"
            className={`cw-segmented-btn ${mode === 'pk' ? 'cw-segmented-btn--active' : ''}`}
            onClick={() => setMode('pk')}
          >
            PK
          </button>
          <button
            type="button"
            className={`cw-segmented-btn ${mode === 'br' ? 'cw-segmented-btn--active' : ''}`}
            onClick={() => setMode('br')}
          >
            {pick('大逃杀', 'Battle Royale')}
          </button>
        </section>

        {mode === 'pk' ? (
          <>
            <section className="cw-panel cw-panel--cool">
              <div className="cw-section-head">
                <div>
                  <span className="cw-label">PK</span>
                  <h3>
                    {companion.pkWins + companion.pkLosses > 0
                      ? `${companion.pkWins}W / ${companion.pkLosses}L`
                      : pick('还没有已结算 PK', 'No settled PK yet')}
                  </h3>
                </div>
                <span className="cw-chip cw-chip--cool">
                  <Swords size={14} />
                  {companion.pkWinRate}%
                </span>
              </div>
            </section>

            <PKArenaPanel
              tokenId={companion.hasToken ? companion.tokenId : undefined}
              ownerAddress={companion.ownerAddress}
              companionName={companion.name}
              reserve={companion.routerClaworld}
              reserveText={companion.routerClaworldText}
              level={companion.level}
              traits={companion.traits}
            />
          </>
        ) : (
          <>
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
                      : pick('还没有可读对局', 'No readable match')}
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
                    <span className="cw-label">{pick('最小入场', 'Min stake')}</span>
                    <strong>{formatCLW(battleRoyale.minStake)}</strong>
                  </div>
                  <div className="cw-state-card">
                    <span className="cw-label">{pick('待领', 'Claim')}</span>
                    <strong>{claimWindow.claimable > 0n ? formatCLW(claimWindow.claimable) : '--'}</strong>
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
          </>
        )}
      </WalletGate>
    </>
  );
}
