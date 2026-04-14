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
} from 'lucide-react';
import { parseEther } from 'viem';
import { useBlockNumber, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { type ParticipantPath } from '@/components/lobster/useBattleRoyaleParticipantState';
import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';

const ROOMS = Array.from({ length: 10 }, (_, index) => index + 1);

function parseAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return parseEther(trimmed);
  } catch {
    return null;
  }
}

function matchStatusText(status: number) {
  if (status === 0) return '开放中';
  if (status === 1) return '待揭示';
  if (status === 2) return '已结算';
  return '未知';
}

function brError(error: unknown) {
  if (!(error instanceof Error)) return '大逃杀操作失败。';
  const message = error.message;
  if (message.includes('User rejected') || message.includes('OKX Wallet Reject')) return '钱包取消了这次签名。';
  if (message.includes('Already entered this match')) return '这只龙虾已经在当前对局里。';
  if (message.includes('Not NFA owner')) return '当前钱包不是这只龙虾的持有人。';
  if (message.includes('Wrong autonomous NFA')) return '当前对局不是这只龙虾的参赛记录。';
  if (message.includes('Stake below match minimum')) return '质押低于当前对局门槛。';
  if (message.includes('Room change limit reached')) return '这一局只能换房一次。';
  if (message.includes('Insufficient CLW balance')) return '这只龙虾的记账账户余额不够。';
  if (message.includes('Match not open')) return '当前这局已经不能加入了。';
  return message;
}

export function BattleRoyaleArenaPanel({
  matchId,
  status,
  revealBlock,
  totalPlayers,
  triggerCount,
  pot,
  minStake,
  tokenId,
  reserve,
  participant,
  onRefresh,
  isRefreshing,
}: {
  matchId?: bigint;
  status: number;
  revealBlock: bigint;
  totalPlayers: number;
  triggerCount: number;
  pot: bigint;
  minStake: bigint;
  tokenId?: bigint;
  reserve: bigint;
  participant: {
    preferredPath: ParticipantPath | null;
    ownerPath: ParticipantPath;
    autonomyPath: ParticipantPath;
    claimable: bigint;
    hasConflict: boolean;
  };
  onRefresh: () => void;
  isRefreshing?: boolean;
}) {
  const [selectedRoom, setSelectedRoom] = useState(1);
  const [amountInput, setAmountInput] = useState('');
  const [pendingAction, setPendingAction] = useState<'enter' | 'change' | 'claim' | 'reveal' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);

  const { data: hash, error, isPending, writeContractAsync } = useWriteContract();
  const receiptQuery = useWaitForTransactionReceipt({ hash });
  const blockNumberQuery = useBlockNumber({ watch: true });

  useEffect(() => {
    setAmountInput(minStake > 0n ? (Number(minStake) / 1e18).toString() : '');
  }, [minStake, matchId]);

  const snapshotQuery = useReadContract({
    address: addresses.battleRoyale,
    abi: BattleRoyaleABI,
    functionName: 'getMatchSnapshot',
    args: matchId ? [matchId] : undefined,
    query: { enabled: Boolean(matchId) },
  });

  const roomChangeCountQuery = useReadContract({
    address: addresses.battleRoyale,
    abi: BattleRoyaleABI,
    functionName: 'roomChangeCount',
    args: matchId && participant.preferredPath?.address ? [matchId, participant.preferredPath.address] : undefined,
    query: { enabled: Boolean(matchId && participant.preferredPath?.address) },
  });

  const snapshot = snapshotQuery.data as readonly [readonly bigint[], readonly bigint[]] | undefined;
  const playerCounts = snapshot?.[0] ?? [];
  const roomTotals = snapshot?.[1] ?? [];

  const rooms = useMemo(
    () =>
      ROOMS.map((roomId, index) => ({
        roomId,
        players: Number(playerCounts[index] ?? 0n),
        total: BigInt(roomTotals[index] ?? 0n),
      })),
    [playerCounts, roomTotals],
  );

  const amount = parseAmount(amountInput);
  const activePath = participant.preferredPath;
  const currentRoom = activePath?.roomId ?? 0;
  const currentStake = activePath?.stake ?? 0n;
  const roomChangeCount = Number(roomChangeCountQuery.data ?? 0);
  const currentBlock = BigInt(blockNumberQuery.data?.toString() ?? '0');
  const refreshing = Boolean(
    isRefreshing || snapshotQuery.isFetching || roomChangeCountQuery.isFetching,
  );
  const ownerJoined = participant.ownerPath.matchesToken && participant.ownerPath.entered;
  const nfaJoined = participant.autonomyPath.matchesToken && participant.autonomyPath.entered;
  const canChangeRoom = Boolean(activePath?.entered) && status === 0 && roomChangeCount < 1 && !participant.hasConflict;
  const hasEnoughReserve = amount === null || reserve >= amount;
  const ownerClaimReady =
    participant.claimable > 0n &&
    participant.preferredPath?.key === 'owner' &&
    !participant.hasConflict;
  const nfaClaimReady =
    participant.claimable > 0n &&
    participant.preferredPath?.key === 'autonomy' &&
    !participant.hasConflict;
  const canRevealNow =
    status === 1 &&
    revealBlock > 0n &&
    currentBlock > revealBlock &&
    currentBlock - revealBlock <= 256n;
  const revealExpired =
    status === 1 &&
    revealBlock > 0n &&
    currentBlock > revealBlock + 256n;

  async function refreshAll() {
    await Promise.all([
      onRefresh(),
      snapshotQuery.refetch(),
      roomChangeCountQuery.refetch(),
    ]);
  }

  useEffect(() => {
    if (currentRoom > 0) setSelectedRoom(currentRoom);
  }, [currentRoom]);

  async function handleAction(kind: 'enter' | 'change' | 'claim' | 'reveal') {
    if (!matchId) return;
    setActionError(null);
    setResultText(null);
    setPendingAction(kind);
    try {
      if (kind === 'enter') {
        if (amount === null) throw new Error('请输入有效的质押数。');
        if (tokenId === undefined) throw new Error('先选一只龙虾。');
        if (reserve < amount) throw new Error('这只龙虾的储备不够。');
        await writeContractAsync({
          address: addresses.battleRoyale,
          abi: BattleRoyaleABI,
          functionName: 'enterRoomForNfa',
          args: [matchId, tokenId, selectedRoom, amount],
        });
      } else if (kind === 'change') {
        await writeContractAsync({
          address: addresses.battleRoyale,
          abi: BattleRoyaleABI,
          functionName:
            activePath?.key === 'autonomy' && tokenId !== undefined ? 'changeRoomForNfa' : 'changeRoom',
          args:
            activePath?.key === 'autonomy' && tokenId !== undefined
              ? [matchId, tokenId, selectedRoom]
              : [matchId, selectedRoom],
        });
      } else if (kind === 'reveal') {
        await writeContractAsync({
          address: addresses.battleRoyale,
          abi: BattleRoyaleABI,
          functionName: 'reveal',
          args: [matchId],
        });
      } else {
        await writeContractAsync({
          address: addresses.battleRoyale,
          abi: BattleRoyaleABI,
          functionName:
            activePath?.key === 'autonomy' && tokenId !== undefined ? 'claimForNfa' : 'claim',
          args:
            activePath?.key === 'autonomy' && tokenId !== undefined
              ? [matchId, tokenId]
              : [matchId],
        });
      }
    } catch (nextError) {
      setPendingAction(null);
      setActionError(brError(nextError));
    }
  }

  useEffect(() => {
    if (!receiptQuery.isSuccess || !pendingAction) return;
    if (pendingAction === 'enter') setResultText(`已加入 ${selectedRoom} 号房。`);
    if (pendingAction === 'change') setResultText(`已换到 ${selectedRoom} 号房。`);
    if (pendingAction === 'reveal') setResultText('这一局已经结算，合约会自动开下一局。');
    if (pendingAction === 'claim') {
      setResultText(
        activePath?.key === 'autonomy'
          ? `奖励已回到 NFA 记账账户 ${formatCLW(participant.claimable)}。`
          : `已领取 ${formatCLW(participant.claimable)}。`,
      );
    }
    setPendingAction(null);
    void refreshAll();
  }, [activePath?.key, onRefresh, participant.claimable, pendingAction, receiptQuery.isSuccess, roomChangeCountQuery, selectedRoom, snapshotQuery]);

  if (!matchId) {
    return (
      <div className="cw-list">
        <div className="cw-list-item cw-list-item--cool">
          <Shield size={16} />
          <span>当前没有可查看的大逃杀对局。</span>
        </div>
      </div>
    );
  }

  return (
    <div className="cw-page">
      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">当前对局</span>
            <h3>大逃杀 #{matchId.toString()}</h3>
          </div>
          <button
            type="button"
            className="cw-button cw-button--ghost"
            onClick={() => void refreshAll()}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'cw-spin' : ''} />
            {refreshing ? '刷新中' : '刷新'}
          </button>
        </div>

        <div className="cw-state-grid">
          <div className="cw-state-card">
            <span className="cw-label">状态</span>
            <strong>{matchStatusText(status)}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">人数</span>
            <strong>{triggerCount > 0 ? `${totalPlayers}/${triggerCount}` : '--'}</strong>
          </div>
            <div className="cw-state-card">
              <span className="cw-label">奖池</span>
              <strong>{formatCLW(pot)}</strong>
            </div>
            {status === 1 ? (
              <div className="cw-state-card">
                <span className="cw-label">揭示块</span>
                <strong>#{revealBlock.toString()}</strong>
              </div>
            ) : null}
        </div>

        <div className="cw-rule-strip">
          <div className="cw-rule-copy">
            <span className="cw-label">规则</span>
            <strong>任选一个房间质押代币躲避，满 10 人后随机一个房间被杀掉，幸存房按质押代币数瓜分奖励。</strong>
          </div>
          <div className="cw-pill-row">
            <span className="cw-chip cw-chip--warm">满 10 人开杀</span>
            <span className="cw-chip cw-chip--cool">可换房 1 次</span>
            <span className="cw-chip cw-chip--growth">结算后自动开新局</span>
          </div>
        </div>

        {activePath ? (
          <div className="cw-stage-stats">
            <div className="cw-mini-stat">
              <span>当前房间</span>
              <strong>{activePath.roomId ? `${activePath.roomId} 号房` : '未加入'}</strong>
            </div>
            <div className="cw-mini-stat">
              <span>当前质押</span>
              <strong>{currentStake > 0n ? formatCLW(currentStake) : '--'}</strong>
            </div>
            <div className="cw-mini-stat">
              <span>参赛路径</span>
              <strong>{activePath.key === 'autonomy' ? 'NFA 记账账户' : '持有人钱包'}</strong>
            </div>
            <div className="cw-mini-stat">
              <span>换房次数</span>
              <strong>{roomChangeCount}/1</strong>
            </div>
          </div>
        ) : null}

        {ownerClaimReady ? (
          <div className="cw-button-row">
            <button type="button" className="cw-button cw-button--primary" onClick={() => void handleAction('claim')}>
              <Trophy size={16} />
              领取 {formatCLW(participant.claimable)}
            </button>
          </div>
        ) : null}

        {nfaClaimReady ? (
          <div className="cw-button-row">
            <button type="button" className="cw-button cw-button--primary" onClick={() => void handleAction('claim')}>
              <Coins size={16} />
              回记账账户 {formatCLW(participant.claimable)}
            </button>
            <Link href="/" className="cw-button cw-button--ghost">
              <Shield size={16} />
              去维护提现
            </Link>
          </div>
        ) : null}

        {status === 1 ? (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--warm">
              <Shield size={16} />
              <span>
                {canRevealNow
                  ? '已经到揭示块，这一步需要有人触发揭示；结算完成后合约会自动开下一局。'
                  : revealExpired
                    ? '普通揭示窗口已过，需要管理员补 emergencyReveal，补完后合约才会自动开下一局。'
                    : '人数已满，先等揭示块到来；到了之后需要有人触发揭示，结算后会自动开下一局。'}
              </span>
            </div>
            {canRevealNow ? (
              <div className="cw-button-row">
                <button
                  type="button"
                  className="cw-button cw-button--primary"
                  onClick={() => void handleAction('reveal')}
                >
                  <Trophy size={16} />
                  触发揭示
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">房间列表</span>
            <h3>{activePath?.entered ? '可以换房一次' : '点一间房，再确认从 NFA 记账账户入场'}</h3>
          </div>
          <span className="cw-chip cw-chip--cool">
            <Shield size={14} />
            最低 {formatCLW(minStake)}
          </span>
        </div>

        <div className="cw-room-grid">
          {rooms.map((room) => (
            <button
              key={room.roomId}
              type="button"
              className={`cw-room-tile ${selectedRoom === room.roomId ? 'cw-room-tile--selected' : ''} ${currentRoom === room.roomId ? 'cw-room-tile--current' : ''}`}
              onClick={() => setSelectedRoom(room.roomId)}
            >
              <span>{room.roomId} 号房</span>
              <strong>{room.players} 人</strong>
              <em>{formatCLW(room.total)}</em>
            </button>
          ))}
        </div>

        {!ownerJoined && !nfaJoined ? (
          <>
            <div className="cw-detail-list">
              <div className="cw-detail-row">
                <span>当前选房</span>
                <strong>{selectedRoom} 号房</strong>
              </div>
              <div className="cw-detail-row">
                <span>最低门槛</span>
                <strong>{formatCLW(minStake)}</strong>
              </div>
              <div className="cw-detail-row">
                <span>入场路径</span>
                <strong>NFA 记账账户</strong>
              </div>
              <div className="cw-detail-row">
                <span>当前储备</span>
                <strong>{formatCLW(reserve)}</strong>
              </div>
            </div>
            <label className="cw-field">
              <span className="cw-label">质押数</span>
              <input
                className="cw-input"
                inputMode="decimal"
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                placeholder="100"
              />
            </label>
            <div className="cw-button-row">
              <button
                type="button"
                className="cw-button cw-button--primary"
                onClick={() => void handleAction('enter')}
                disabled={!amount || amount < minStake || status !== 0 || !hasEnoughReserve || tokenId === undefined}
              >
                <Swords size={16} />
                加入 {selectedRoom} 号房
              </button>
            </div>
          </>
        ) : null}

        {canChangeRoom ? (
          <div className="cw-button-row">
            <button
              type="button"
              className="cw-button cw-button--primary"
              onClick={() => void handleAction('change')}
              disabled={selectedRoom === currentRoom}
            >
              <Swords size={16} />
              换到 {selectedRoom} 号房
            </button>
          </div>
        ) : null}

        {nfaJoined ? (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--growth">
              <Shield size={16} />
              <span>这只龙虾已经用记账账户参赛，换房和领奖都会直接回到这只 NFA 的记账账户。</span>
            </div>
          </div>
        ) : null}

        {!hasEnoughReserve && amount !== null ? (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--alert">
              <AlertTriangle size={16} />
              <span>{`记账账户只有 ${formatCLW(reserve)}，不够质押 ${amountInput || '0'}。`}</span>
            </div>
          </div>
        ) : null}
      </section>

      {(snapshotQuery.error || actionError || error || isPending || receiptQuery.isLoading || resultText) ? (
        <div className="cw-list">
          {snapshotQuery.error ? (
            <div className="cw-list-item cw-list-item--alert">
              <AlertTriangle size={16} />
              <span>房间数据读取失败。</span>
            </div>
          ) : null}
          {isPending ? (
            <div className="cw-list-item cw-list-item--warm">
              <Shield size={16} />
              <span>请去钱包确认这一步大逃杀交易。</span>
            </div>
          ) : null}
          {receiptQuery.isLoading ? (
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>交易已发出，正在等待链上回执。</span>
            </div>
          ) : null}
          {resultText ? (
            <div className="cw-list-item cw-list-item--growth">
              <CheckCircle2 size={16} />
              <span>{resultText}</span>
            </div>
          ) : null}
          {actionError ? (
            <div className="cw-list-item cw-list-item--alert">
              <AlertTriangle size={16} />
              <span>{actionError}</span>
            </div>
          ) : null}
          {error && !actionError ? (
            <div className="cw-list-item cw-list-item--alert">
              <AlertTriangle size={16} />
              <span>{brError(error)}</span>
            </div>
          ) : null}
          {hash ? (
            <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="cw-inline-link">
              查看交易 <ArrowUpRight size={14} />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
