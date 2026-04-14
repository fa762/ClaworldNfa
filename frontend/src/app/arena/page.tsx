'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Coins,
  RefreshCw,
  Shield,
  Swords,
  Trophy,
  X,
} from 'lucide-react';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

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
import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type ArenaSheet = 'pk' | 'br' | null;
type ArenaHistoryDetail =
  | { kind: 'pk'; entry: PkHistoryEntry }
  | { kind: 'br'; entry: BrHistoryEntry }
  | null;

function matchStatusText(status: number, pick: (zh: string, en: string) => string) {
  if (status === 0) return pick('进行中', 'Open');
  if (status === 1) return pick('等待揭示', 'Pending reveal');
  if (status === 2) return pick('已结算', 'Settled');
  return pick('未知', 'Unknown');
}

function battleRoyaleClaimError(error: unknown, pick: (zh: string, en: string) => string) {
  if (!(error instanceof Error)) return pick('领取失败，请稍后重试。', 'Claim failed. Retry later.');
  const message = error.message;
  if (message.includes('User rejected') || message.includes('OKX Wallet Reject')) {
    return pick('钱包取消了这次签名。', 'Wallet rejected this signature.');
  }
  if (message.includes('Already claimed')) {
    return pick('这笔奖励已经领过了。', 'This reward is already claimed.');
  }
  if (message.includes('Not NFA owner')) {
    return pick('当前钱包不是这只龙虾的持有人。', 'This wallet is not the owner of this lobster.');
  }
  if (message.includes('Wrong autonomous NFA')) {
    return pick('这笔奖励不属于当前选中的龙虾。', 'This reward does not belong to the selected lobster.');
  }
  if (message.includes('Prize contract balance is too low')) {
    return pick('奖池余额不足，暂时不能手动领。', 'Prize balance is too low for direct claim.');
  }
  return message;
}

export default function ArenaPage() {
  const { pick } = useI18n();
  const companion = useActiveCompanion();
  const [sheet, setSheet] = useState<ArenaSheet>(null);
  const [historyDetail, setHistoryDetail] = useState<ArenaHistoryDetail>(null);
  const [claimingEntry, setClaimingEntry] = useState<BrHistoryEntry | null>(null);
  const [claimResult, setClaimResult] = useState<string | null>(null);
  const [claimLocalError, setClaimLocalError] = useState<string | null>(null);

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

  const { data: claimHash, error: claimError, isPending: claimPending, writeContractAsync } = useWriteContract();
  const claimReceiptQuery = useWaitForTransactionReceipt({ hash: claimHash });

  useEffect(() => {
    if (!claimReceiptQuery.isSuccess || !claimingEntry) return;

    const result = claimingEntry.path === 'autonomy'
      ? pick('奖励已回到这只 NFA 的记账账户，去首页维护里提现。', 'Reward returned to the lobster ledger account.')
      : pick('奖励已领取到主钱包。', 'Reward claimed to the owner wallet.');

    setClaimResult(result);
    setClaimLocalError(null);
    setHistoryDetail((current) => {
      if (!current || current.kind !== 'br' || current.entry.matchId !== claimingEntry.matchId) return current;
      return {
        kind: 'br',
        entry: {
          ...current.entry,
          claimable: 0n,
          claimed: true,
          result: pick('已领取', 'Claimed'),
        },
      };
    });
    setClaimingEntry(null);
    void Promise.all([history.refresh(), battleRoyale.refresh()]);
  }, [battleRoyale, claimReceiptQuery.isSuccess, claimingEntry, history, pick]);

  async function handleHistoryClaim(entry: BrHistoryEntry) {
    setClaimLocalError(null);
    setClaimResult(null);
    setClaimingEntry(entry);
    try {
      if (entry.path === 'autonomy') {
        if (!companion.tokenId) throw new Error(pick('先选一只龙虾。', 'Select a lobster first.'));
        await writeContractAsync({
          address: addresses.battleRoyale,
          abi: BattleRoyaleABI,
          functionName: 'claimForNfa',
          args: [BigInt(entry.matchId), companion.tokenId],
        });
      } else {
        await writeContractAsync({
          address: addresses.battleRoyale,
          abi: BattleRoyaleABI,
          functionName: 'claim',
          args: [BigInt(entry.matchId)],
        });
      }
    } catch (error) {
      setClaimingEntry(null);
      setClaimLocalError(battleRoyaleClaimError(error, pick));
    }
  }

  const claimableAmount = participant.claimable;

  const pkSummary = companion.pkWins + companion.pkLosses > 0
    ? `${companion.pkWins}${pick('胜', 'W')} / ${companion.pkLosses}${pick('败', 'L')}`
    : pick('当前空闲', 'Idle');

  const brSummary = useMemo(() => {
    if (claimableAmount > 0n) return `${pick('可领', 'Claim')} ${formatCLW(claimableAmount)}`;
    if (battleRoyale.ready) {
      return `${matchStatusText(battleRoyale.status, pick)} · ${battleRoyale.totalPlayers}/${battleRoyale.triggerCount}`;
    }
    return pick('查看对局', 'View rooms');
  }, [battleRoyale.ready, battleRoyale.status, battleRoyale.totalPlayers, battleRoyale.triggerCount, claimableAmount, pick]);

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
            <span>{pick('进入', 'Open')}</span>
          </div>
        </button>

        <button
          type="button"
          className={`cw-card cw-card--button cw-card--warm ${sheet === 'br' ? 'cw-card--selected' : ''}`}
          onClick={() => setSheet('br')}
        >
          <div className="cw-card-icon"><Trophy size={18} /></div>
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

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">PK {pick('历史战绩', 'History')}</span>
            <h3>{pick('最近参与', 'Recent matches')}</h3>
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
                  <span>{`${entry.role} / ${pick('对手', 'Opponent')} #${entry.opponent || '--'}`}</span>
                </div>
                <div className="cw-history-score">
                  <strong>{formatCLW(entry.stake)}</strong>
                  <span>{entry.reward > 0n ? `${pick('本局奖励', 'Reward')} ${formatCLW(entry.reward)}` : pick('查看详情', 'Details')}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>{pick('最近还没有 PK 记录。', 'No PK history yet.')}</span>
            </div>
          </div>
        )}
      </section>

      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('大逃杀历史战绩', 'Battle Royale history')}</span>
            <h3>{pick('最近参与', 'Recent runs')}</h3>
          </div>
          <button
            type="button"
            className="cw-button cw-button--ghost"
            onClick={() => void history.refresh()}
            disabled={history.isLoading}
          >
            <RefreshCw size={16} className={history.isLoading ? 'cw-spin' : ''} />
            {history.isLoading ? pick('刷新中', 'Refreshing') : pick('刷新', 'Refresh')}
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
                  <span className="cw-label">{pick('大逃杀', 'Battle Royale')} #{entry.matchId}</span>
                  <strong>{entry.result}</strong>
                  <span>{`${entry.pathLabel} / ${entry.roomId > 0 ? `${entry.roomId}${pick('号房', ' room')}` : pick('未入场', 'Not entered')}`}</span>
                </div>
                <div className="cw-history-score">
                  <strong>{formatCLW(entry.stake)}</strong>
                  <span>{entry.claimable > 0n ? `${pick('可领', 'Claim')} ${formatCLW(entry.claimable)}` : pick('查看详情', 'Details')}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>{pick('最近还没有大逃杀记录。', 'No Battle Royale history yet.')}</span>
            </div>
          </div>
        )}

        {history.error ? <p className="cw-muted">{history.error}</p> : null}
      </section>

      {sheet ? (
        <section className="cw-modal" aria-modal="true" role="dialog">
          <button type="button" className="cw-modal__scrim" aria-label={pick('关闭', 'Close')} onClick={() => setSheet(null)} />
          <div className="cw-modal__sheet">
            <section className="cw-sheet">
              <div className="cw-sheet-head">
                <div>
                  <span className="cw-label">{sheet === 'pk' ? 'PK' : pick('大逃杀', 'Battle Royale')}</span>
                  <h3>{sheet === 'pk' ? pick('选择 PK 动作', 'Pick a PK action') : pick('选房加入', 'Choose a room')}</h3>
                </div>
                <button type="button" className="cw-icon-button cw-sheet-close" onClick={() => setSheet(null)} aria-label={pick('关闭', 'Close')}>
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
                  {pick('关闭', 'Close')}
                </button>
              </div>
            </section>
          </div>
        </section>
      ) : null}

      {historyDetail ? (
        <section className="cw-modal" aria-modal="true" role="dialog">
          <button type="button" className="cw-modal__scrim" aria-label={pick('关闭', 'Close')} onClick={() => setHistoryDetail(null)} />
          <div className="cw-modal__sheet">
            <section className="cw-sheet">
              <div className="cw-sheet-head">
                <div>
                  <span className="cw-label">
                    {historyDetail.kind === 'pk' ? pick('PK 历史详情', 'PK history') : pick('大逃杀历史详情', 'Battle Royale history')}
                  </span>
                  <h3>
                    {historyDetail.kind === 'pk'
                      ? `PK #${historyDetail.entry.matchId}`
                      : `${pick('大逃杀', 'Battle Royale')} #${historyDetail.entry.matchId}`}
                  </h3>
                </div>
                <button type="button" className="cw-icon-button cw-sheet-close" onClick={() => setHistoryDetail(null)} aria-label={pick('关闭', 'Close')}>
                  <X size={16} />
                </button>
              </div>

              {historyDetail.kind === 'pk' ? (
                <div className="cw-detail-list">
                  <div className="cw-detail-row">
                    <span>{pick('结果', 'Result')}</span>
                    <strong>{historyDetail.entry.result}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('身份', 'Role')}</span>
                    <strong>{historyDetail.entry.role}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('对手', 'Opponent')}</span>
                    <strong>{historyDetail.entry.opponent > 0 ? `#${historyDetail.entry.opponent}` : '--'}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('我的策略', 'My strategy')}</span>
                    <strong>{historyDetail.entry.myStrategy}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('对手策略', 'Opponent strategy')}</span>
                    <strong>{historyDetail.entry.opponentStrategy}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('质押', 'Stake')}</span>
                    <strong>{formatCLW(historyDetail.entry.stake)}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('本局奖励', 'Reward')}</span>
                    <strong>{historyDetail.entry.reward > 0n ? formatCLW(historyDetail.entry.reward) : '--'}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('10% 销毁', '10% burned')}</span>
                    <strong>{historyDetail.entry.burned > 0n ? formatCLW(historyDetail.entry.burned) : '--'}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('赢家', 'Winner')}</span>
                    <strong>{historyDetail.entry.winnerNfaId > 0 ? `#${historyDetail.entry.winnerNfaId}` : '--'}</strong>
                  </div>
                </div>
              ) : (
                <div className="cw-detail-list">
                  <div className="cw-detail-row">
                    <span>{pick('结果', 'Result')}</span>
                    <strong>{historyDetail.entry.result}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('路径', 'Path')}</span>
                    <strong>{historyDetail.entry.pathLabel}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('房间', 'Room')}</span>
                    <strong>{historyDetail.entry.roomId > 0 ? `${historyDetail.entry.roomId}${pick('号房', ' room')}` : '--'}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('质押', 'Stake')}</span>
                    <strong>{formatCLW(historyDetail.entry.stake)}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('奖池', 'Pot')}</span>
                    <strong>{formatCLW(historyDetail.entry.pot)}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('状态', 'Status')}</span>
                    <strong>{matchStatusText(historyDetail.entry.status, pick)}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('淘汰房', 'Losing room')}</span>
                    <strong>{historyDetail.entry.losingRoom > 0 ? `${historyDetail.entry.losingRoom}${pick('号房', ' room')}` : '--'}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('可领奖励', 'Claimable')}</span>
                    <strong>{historyDetail.entry.claimable > 0n ? formatCLW(historyDetail.entry.claimable) : '--'}</strong>
                  </div>
                  <div className="cw-detail-row">
                    <span>{pick('参赛人数', 'Players')}</span>
                    <strong>{historyDetail.entry.totalPlayers}</strong>
                  </div>
                </div>
              )}

              {historyDetail.kind === 'br' ? (
                <div className="cw-list">
                  <div className="cw-list-item cw-list-item--warm">
                    <Trophy size={16} />
                    <span>
                      {pick(
                        '任选一个房间质押代币躲避，满 10 人后随机一个房间被杀掉，幸存房按质押代币数瓜分奖励。',
                        'Pick a room, hide with stake, one room gets wiped at 10 players, survivors split the reward by stake.',
                      )}
                    </span>
                  </div>
                </div>
              ) : null}

              {historyDetail.kind === 'br' && historyDetail.entry.claimable > 0n ? (
                <div className="cw-button-row">
                  <button
                    type="button"
                    className="cw-button cw-button--primary"
                    onClick={() => void handleHistoryClaim(historyDetail.entry)}
                    disabled={claimPending || claimReceiptQuery.isLoading}
                  >
                    {historyDetail.entry.path === 'autonomy' ? <Coins size={16} /> : <Trophy size={16} />}
                    {historyDetail.entry.path === 'autonomy'
                      ? `${pick('领回记账账户', 'Credit ledger')} ${formatCLW(historyDetail.entry.claimable)}`
                      : `${pick('领取', 'Claim')} ${formatCLW(historyDetail.entry.claimable)}`}
                  </button>
                  {historyDetail.entry.path === 'autonomy' ? (
                    <Link href="/" className="cw-button cw-button--ghost">
                      <Shield size={16} />
                      {pick('去首页提现', 'Go withdraw')}
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {historyDetail.kind === 'br' && historyDetail.entry.path === 'autonomy' && historyDetail.entry.claimed ? (
                <div className="cw-button-row">
                  <Link href="/" className="cw-button cw-button--ghost">
                    <Shield size={16} />
                    {pick('去首页维护提现', 'Withdraw from Home')}
                  </Link>
                </div>
              ) : null}

              {(claimPending || claimReceiptQuery.isLoading || claimResult || claimLocalError || claimError) &&
              historyDetail.kind === 'br' ? (
                <div className="cw-list">
                  {claimPending ? (
                    <div className="cw-list-item cw-list-item--warm">
                      <Shield size={16} />
                      <span>{pick('请去钱包确认这次领奖。', 'Confirm this claim in your wallet.')}</span>
                    </div>
                  ) : null}
                  {claimReceiptQuery.isLoading ? (
                    <div className="cw-list-item cw-list-item--cool">
                      <Shield size={16} />
                      <span>{pick('交易已发出，正在等待链上回执。', 'Transaction sent. Waiting for confirmation.')}</span>
                    </div>
                  ) : null}
                  {claimResult ? (
                    <div className="cw-list-item cw-list-item--growth">
                      <CheckCircle2 size={16} />
                      <span>{claimResult}</span>
                    </div>
                  ) : null}
                  {claimLocalError ? (
                    <div className="cw-list-item cw-list-item--alert">
                      <AlertTriangle size={16} />
                      <span>{claimLocalError}</span>
                    </div>
                  ) : null}
                  {claimError && !claimLocalError ? (
                    <div className="cw-list-item cw-list-item--alert">
                      <AlertTriangle size={16} />
                      <span>{battleRoyaleClaimError(claimError, pick)}</span>
                    </div>
                  ) : null}
                  {claimHash ? (
                    <a
                      href={getBscScanTxUrl(claimHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cw-inline-link"
                    >
                      {pick('查看交易', 'View transaction')} <ArrowUpRight size={14} />
                    </a>
                  ) : null}
                </div>
              ) : null}

              <div className="cw-button-row">
                {historyDetail.kind === 'pk' && historyDetail.entry.txHash ? (
                  <a
                    href={getBscScanTxUrl(historyDetail.entry.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cw-button cw-button--ghost"
                  >
                    <ArrowUpRight size={16} />
                    {pick('查看交易', 'View transaction')}
                  </a>
                ) : null}
                <button type="button" className="cw-button cw-button--ghost" onClick={() => setHistoryDetail(null)}>
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
