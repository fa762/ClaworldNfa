'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, RefreshCw, Shield, Swords, Trophy, X } from 'lucide-react';

import { BattleRoyaleArenaPanel } from '@/components/game/BattleRoyaleArenaPanel';
import { PKArenaPanel } from '@/components/game/PKArenaPanel';
import {
  useArenaHistory,
  type BrHistoryEntry,
  type PkHistoryEntry,
} from '@/components/game/useArenaHistory';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useBattleRoyaleParticipantState } from '@/components/lobster/useBattleRoyaleParticipantState';
import { useBattleRoyaleOverview } from '@/components/lobster/useBattleRoyaleOverview';
import { WalletGate } from '@/components/wallet/WalletGate';
import { getBscScanTxUrl } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type ArenaSheet = 'pk' | 'br' | null;
type ArenaHistoryDetail =
  | { kind: 'pk'; entry: PkHistoryEntry }
  | { kind: 'br'; entry: BrHistoryEntry }
  | null;

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
  const [historyDetail, setHistoryDetail] = useState<ArenaHistoryDetail>(null);
  const battleRoyale = useBattleRoyaleOverview();
  const history = useArenaHistory(
    companion.hasToken ? companion.tokenId : undefined,
    companion.ownerAddress,
  );
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

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">PK 历史战绩</span>
            <h3>最近参与</h3>
          </div>
        </div>

        {history.pkHistory.length > 0 ? (
          <div className="cw-list">
            {history.pkHistory.map((entry) => (
              <button
                key={`pk-history-${entry.matchId}`}
                type="button"
                className="cw-history-row"
                onClick={() => setHistoryDetail({ kind: 'pk', entry })}
              >
                <div className="cw-history-copy">
                  <span className="cw-label">PK #{entry.matchId}</span>
                  <strong>{entry.result}</strong>
                  <span>{`${entry.role} / 对手 #${entry.opponent || '--'}`}</span>
                </div>
                <div className="cw-history-score">
                  <strong>{formatCLW(entry.stake)}</strong>
                  <span>{entry.reward > 0n ? `赢得 ${formatCLW(entry.reward)}` : '看详情'}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>最近还没有 PK 记录。</span>
            </div>
          </div>
        )}
      </section>

      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">大逃杀历史战绩</span>
            <h3>最近参与</h3>
          </div>
          <button
            type="button"
            className="cw-button cw-button--ghost"
            onClick={() => void history.refresh()}
            disabled={history.isLoading}
          >
            <RefreshCw size={16} className={history.isLoading ? 'cw-spin' : ''} />
            {history.isLoading ? '刷新中' : '刷新'}
          </button>
        </div>

        {history.brHistory.length > 0 ? (
          <div className="cw-list">
            {history.brHistory.map((entry) => (
              <button
                key={`br-history-${entry.matchId}`}
                type="button"
                className="cw-history-row"
                onClick={() => setHistoryDetail({ kind: 'br', entry })}
              >
                <div className="cw-history-copy">
                  <span className="cw-label">大逃杀 #{entry.matchId}</span>
                  <strong>{entry.result}</strong>
                  <span>{`${entry.path} / ${entry.roomId > 0 ? `${entry.roomId} 号房` : '未入场'}`}</span>
                </div>
                <div className="cw-history-score">
                  <strong>{formatCLW(entry.stake)}</strong>
                  <span>{entry.claimable > 0n ? `待领 ${formatCLW(entry.claimable)}` : '看详情'}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>最近还没有大逃杀记录。</span>
            </div>
          </div>
        )}

        {history.error ? <p className="cw-muted">{history.error}</p> : null}
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
                  tokenId={companion.hasToken ? companion.tokenId : undefined}
                  reserve={companion.routerClaworld}
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

      {historyDetail ? (
        <section className="cw-modal" aria-modal="true" role="dialog">
          <button type="button" className="cw-modal__scrim" aria-label="关闭" onClick={() => setHistoryDetail(null)} />
          <div className="cw-modal__sheet">
            <section className="cw-sheet">
              <div className="cw-sheet-head">
                <div>
                  <span className="cw-label">{historyDetail.kind === 'pk' ? 'PK 历史详情' : '大逃杀历史详情'}</span>
                  <h3>
                    {historyDetail.kind === 'pk'
                      ? `PK #${historyDetail.entry.matchId}`
                      : `大逃杀 #${historyDetail.entry.matchId}`}
                  </h3>
                </div>
                <button type="button" className="cw-icon-button cw-sheet-close" onClick={() => setHistoryDetail(null)} aria-label="关闭">
                  <X size={16} />
                </button>
              </div>

              {historyDetail.kind === 'pk' ? (
                <div className="cw-detail-list">
                  <div className="cw-detail-row">
                    <span>结果</span>
                    <strong>{historyDetail.entry.result}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>身份</span>
                    <strong>{historyDetail.entry.role}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>对手</span>
                    <strong>{historyDetail.entry.opponent > 0 ? `#${historyDetail.entry.opponent}` : '--'}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>质押</span>
                    <strong>{formatCLW(historyDetail.entry.stake)}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>奖励</span>
                    <strong>{historyDetail.entry.reward > 0n ? formatCLW(historyDetail.entry.reward) : '--'}</strong>
                  </div>
                </div>
              ) : (
                <div className="cw-detail-list">
                  <div className="cw-detail-row">
                    <span>结果</span>
                    <strong>{historyDetail.entry.result}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>路径</span>
                    <strong>{historyDetail.entry.path}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>房间</span>
                    <strong>{historyDetail.entry.roomId > 0 ? `${historyDetail.entry.roomId} 号房` : '--'}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>质押</span>
                    <strong>{formatCLW(historyDetail.entry.stake)}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>奖池</span>
                    <strong>{formatCLW(historyDetail.entry.pot)}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>状态</span>
                    <strong>{matchStatusText(historyDetail.entry.status)}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>待领</span>
                    <strong>{historyDetail.entry.claimable > 0n ? formatCLW(historyDetail.entry.claimable) : '--'}</strong>
                  </div>
                </div>
              )}

              <div className="cw-button-row">
                {historyDetail.kind === 'pk' && historyDetail.entry.txHash ? (
                  <a
                    href={getBscScanTxUrl(historyDetail.entry.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cw-button cw-button--ghost"
                  >
                    <ArrowUpRight size={16} />
                    查看交易
                  </a>
                ) : null}
                <button type="button" className="cw-button cw-button--ghost" onClick={() => setHistoryDetail(null)}>
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
