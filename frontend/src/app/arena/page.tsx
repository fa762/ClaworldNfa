'use client';

import { Shield, Swords, Trophy } from 'lucide-react';

import { BattleRoyaleActionPanel } from '@/components/game/BattleRoyaleActionPanel';
import { BattleRoyaleClaimPanel } from '@/components/game/BattleRoyaleClaimPanel';
import { PKArenaPanel } from '@/components/game/PKArenaPanel';
import { OwnedCompanionRail } from '@/components/lobster/OwnedCompanionRail';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useBattleRoyaleClaimWindow } from '@/components/lobster/useBattleRoyaleClaimWindow';
import { useBattleRoyaleOverview } from '@/components/lobster/useBattleRoyaleOverview';
import { useBattleRoyaleParticipantState } from '@/components/lobster/useBattleRoyaleParticipantState';
import { formatCLW } from '@/lib/format';

function getMatchStatusText(status: number) {
  if (status === 0) return 'Open';
  if (status === 1) return 'Pending reveal';
  if (status === 2) return 'Settled';
  return 'Unknown';
}

export default function ArenaPage() {
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

  const totalPk = companion.pkWins + companion.pkLosses;
  const pkCard = {
    title: 'PK Arena',
    status: totalPk > 0 ? `${companion.pkWins}W / ${companion.pkLosses}L` : 'No settled PK yet',
    detail:
      totalPk > 0
        ? `${companion.pkWinRate}% win rate across recent PK history.`
        : 'The PK surface is ready, but this lobster has no settled PK record yet.',
    score: totalPk > 0 ? `${companion.pkWinRate}%` : 'Cold',
    scoreLabel: totalPk > 0 ? 'win rate' : 'history',
    icon: Swords,
    tone: totalPk > 0 && companion.pkWinRate >= 50 ? 'cw-card--watch' : 'cw-card--safe',
  } as const;

  const battleRoyaleStatus = battleRoyale.ready ? getMatchStatusText(battleRoyale.status) : 'No match found';

  const battleRoyaleCard = {
    title: claimWindow.claimable > 0n ? 'Battle Royale claim' : 'Battle Royale',
    status: claimWindow.claimable > 0n
      ? `Match #${claimWindow.matchId?.toString() ?? '-'} settled`
      : battleRoyale.ready
        ? `Match #${battleRoyale.matchId?.toString()} ${battleRoyaleStatus}`
        : 'Waiting for match data',
    detail: battleRoyale.ready
      ? `${battleRoyale.totalPlayers}/${battleRoyale.triggerCount} players / pot ${formatCLW(battleRoyale.pot)} / min ${formatCLW(battleRoyale.minStake)}${
          claimWindow.claimable > 0n
            ? ` / settled claim ${formatCLW(claimWindow.claimable)}`
            : battleRoyaleParticipant.claimable > 0n
            ? ` / claim ${formatCLW(battleRoyaleParticipant.claimable)}`
            : battleRoyaleParticipant.entered
              ? ` / entered via ${battleRoyaleParticipant.claimPathLabel}`
              : ''
        }`
      : 'The latest match and field data will load here from the contract.',
    score: battleRoyale.ready ? `${battleRoyale.totalPlayers}/${battleRoyale.triggerCount}` : '--',
    scoreLabel: battleRoyale.ready ? 'players' : 'field',
    icon: Trophy,
    tone:
      claimWindow.claimable > 0n || battleRoyaleParticipant.claimable > 0n
        ? 'cw-card--ready'
        : battleRoyale.ready && battleRoyale.status === 0
          ? 'cw-card--warning'
          : battleRoyale.ready && battleRoyale.status === 1
            ? 'cw-card--watch'
            : 'cw-card--safe',
  } as const;

  const pkPosture = totalPk > 0 ? companion.pkWinRate : companion.traits.courage;
  const brPressure =
    battleRoyale.ready && battleRoyale.triggerCount > 0
      ? Math.min(100, Math.round((battleRoyale.totalPlayers / battleRoyale.triggerCount) * 100))
      : 0;

  return (
    <>
      <section className="cw-band">
        <div className="cw-band--split">
          <div>
            <p className="cw-eyebrow">Arena hub</p>
            <h2 className="cw-section-title">{companion.name} enters with clearer field state.</h2>
            <p className="cw-muted">
              PK and Battle Royale now expose real match state, receipt-aware actions, and owner/autonomy boundaries instead of placeholder copy.
            </p>
          </div>
          <div className="cw-score">
            <strong>{battleRoyale.ready ? getMatchStatusText(battleRoyale.status) : 'Live'}</strong>
            <span>arena state</span>
          </div>
        </div>
      </section>

      <OwnedCompanionRail
        title="Arena roster"
        subtitle="Switch the active lobster here before committing to PK or Battle Royale decisions."
      />

      <section className="cw-card-stack">
        {[pkCard, battleRoyaleCard].map(({ title, status, detail, score, scoreLabel, icon: Icon, tone }) => (
          <article key={title} className={`cw-card ${tone}`}>
            <div className="cw-card-icon">
              <Icon size={18} />
            </div>
            <div className="cw-card-copy">
              <p className="cw-label">{title}</p>
              <h3>{status}</h3>
              <p className="cw-muted">{detail}</p>
            </div>
            <div className="cw-score">
              <strong>{score}</strong>
              <span>{scoreLabel}</span>
            </div>
          </article>
        ))}
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
            <span className="cw-label">Field read</span>
            <h3>The arena now reflects record, match state, and participant path.</h3>
          </div>
          <span className="cw-chip cw-chip--cool">
            <Shield size={14} />
            Live read
          </span>
        </div>
        <div className="cw-meter-list">
          <div className="cw-meter-row">
            <div>
              <span className="cw-label">PK posture</span>
              <div className="cw-meter">
                <span className={pkPosture >= 50 ? 'cw-meter--growth' : 'cw-meter--cool'} style={{ width: `${pkPosture}%` }} />
              </div>
            </div>
            <strong>{totalPk > 0 ? `${companion.pkWinRate}% win rate` : `${companion.traits.courage} courage`}</strong>
          </div>
          <div className="cw-meter-row">
            <div>
              <span className="cw-label">BR pressure</span>
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
                ? `Claim ${formatCLW(claimWindow.claimable)} via ${claimWindow.preferredPath?.key === 'autonomy' ? 'autonomy participant' : 'owner wallet'}`
                : battleRoyaleParticipant.claimable > 0n
                ? `Claim ${formatCLW(battleRoyaleParticipant.claimable)} via ${battleRoyaleParticipant.claimPathLabel}`
                : battleRoyaleParticipant.entered
                  ? `Entered via ${battleRoyaleParticipant.claimPathLabel} / room ${battleRoyaleParticipant.preferredPath?.roomId ?? 0}`
                  : battleRoyale.ready
                    ? `${battleRoyale.totalPlayers}/${battleRoyale.triggerCount} seats / round ${battleRoyale.roundId.toString()}`
                    : 'Waiting for match'}
            </strong>
          </div>
        </div>
      </section>

      <section className="cw-list">
        <div className="cw-list-item cw-list-item--warm">
          <Trophy size={16} />
          <span>
            {battleRoyale.ready
              ? `Match #${battleRoyale.matchId?.toString()} pot ${formatCLW(battleRoyale.pot)} with reveal delay ${battleRoyale.revealDelay} blocks.`
              : 'No recent Battle Royale match was readable from the contract.'}
          </span>
        </div>
        <div className="cw-list-item cw-list-item--cool">
          <Shield size={16} />
          <span>
            {battleRoyaleParticipant.hasConflict
              ? 'Both owner and autonomy participant paths look populated. This needs explicit review before surfacing a claim action.'
              : battleRoyale.ready && battleRoyale.leadingRoom.room > 0
                ? `Leading room is ${battleRoyale.leadingRoom.room} with total stake ${battleRoyale.leadingRoom.total}.`
                : 'Room totals will appear once the current match snapshot is readable.'}
          </span>
        </div>
      </section>
    </>
  );
}
