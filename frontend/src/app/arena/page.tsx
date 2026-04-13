'use client';

import { useMemo, useState } from 'react';
import { Swords, Trophy, X } from 'lucide-react';

import { BattleRoyaleArenaPanel } from '@/components/game/BattleRoyaleArenaPanel';
import { PKArenaPanel } from '@/components/game/PKArenaPanel';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useBattleRoyaleParticipantState } from '@/components/lobster/useBattleRoyaleParticipantState';
import { useBattleRoyaleOverview } from '@/components/lobster/useBattleRoyaleOverview';
import { WalletGate } from '@/components/wallet/WalletGate';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type ArenaSheet = 'pk' | 'br' | null;

function matchStatusText(status: number) {
  if (status === 0) return '开放中';
  if (status === 1) return '待揭示';
  if (status === 2) return '已结算';
  return '未知';
}

export default function ArenaPage() {
  const { pick } = useI18n();
  const companion = useActiveCompanion();
  const [sheet, setSheet] = useState<ArenaSheet>(null);
  const battleRoyale = useBattleRoyaleOverview();
  const participant = useBattleRoyaleParticipantState(
    battleRoyale.matchId,
    companion.hasToken ? companion.tokenId : undefined,
    companion.ownerAddress,
  );

  const claimableAmount = participant.claimable;

  const pkSummary = companion.pkWins + companion.pkLosses > 0
    ? `${companion.pkWins}胜 / ${companion.pkLosses}败`
    : '当前空闲';

  const brSummary = useMemo(() => {
    if (claimableAmount > 0n) return `可领 ${formatCLW(claimableAmount)}`;
    if (battleRoyale.ready) return `${matchStatusText(battleRoyale.status)} / ${battleRoyale.totalPlayers}/${battleRoyale.triggerCount}`;
    return '查看大逃杀';
  }, [battleRoyale.ready, battleRoyale.status, battleRoyale.totalPlayers, battleRoyale.triggerCount, claimableAmount]);

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
          <div className="cw-card-icon"><Swords size={18} /></div>
          <div className="cw-card-copy">
            <p className="cw-label">PK</p>
            <h3>{pkSummary}</h3>
          </div>
          <div className="cw-score">
            <strong>{companion.pkWinRate}%</strong>
            <span>进入</span>
          </div>
        </button>

        <button
          type="button"
          className={`cw-card cw-card--button cw-card--warm ${sheet === 'br' ? 'cw-card--selected' : ''}`}
          onClick={() => setSheet('br')}
        >
          <div className="cw-card-icon"><Trophy size={18} /></div>
          <div className="cw-card-copy">
            <p className="cw-label">大逃杀</p>
            <h3>{brSummary}</h3>
          </div>
          <div className="cw-score">
            <strong>{battleRoyale.ready ? formatCLW(battleRoyale.pot) : '--'}</strong>
            <span>进入</span>
          </div>
        </button>
      </section>

      {sheet ? (
        <section className="cw-modal" aria-modal="true" role="dialog">
          <button type="button" className="cw-modal__scrim" aria-label="关闭" onClick={() => setSheet(null)} />
          <div className="cw-modal__sheet">
            <section className="cw-sheet">
              <div className="cw-sheet-head">
                <div>
                  <span className="cw-label">{sheet === 'pk' ? 'PK' : '大逃杀'}</span>
                  <h3>{sheet === 'pk' ? '选择 PK 动作' : '选择房间'}</h3>
                </div>
                <button type="button" className="cw-icon-button cw-sheet-close" onClick={() => setSheet(null)} aria-label="关闭">
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
                  pkWins={companion.pkWins}
                  pkLosses={companion.pkLosses}
                  pkWinRate={companion.pkWinRate}
                  level={companion.level}
                  traits={companion.traits}
                />
              ) : (
                <BattleRoyaleArenaPanel
                  matchId={battleRoyale.matchId}
                  status={battleRoyale.status}
                  totalPlayers={battleRoyale.totalPlayers}
                  triggerCount={battleRoyale.triggerCount}
                  pot={battleRoyale.pot}
                  minStake={battleRoyale.minStake}
                  ownerAddress={companion.ownerAddress}
                  participant={participant}
                  onRefresh={battleRoyale.refresh}
                  isRefreshing={battleRoyale.isRefreshing}
                />
              )}

              <div className="cw-button-row">
                <button type="button" className="cw-button cw-button--ghost" onClick={() => setSheet(null)}>
                  关闭
                </button>
              </div>
            </section>
          </div>
        </section>
      ) : null}
    </WalletGate>
  );
}
