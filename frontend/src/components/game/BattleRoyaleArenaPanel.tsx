'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  RefreshCw,
  Shield,
  Swords,
  Trophy,
} from 'lucide-react';
import { maxUint256, parseEther, type Address } from 'viem';
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { type ParticipantPath } from '@/components/lobster/useBattleRoyaleParticipantState';
import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { ERC20ABI } from '@/contracts/abis/ERC20';
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
  if (message.includes('Stake below match minimum')) return '质押低于当前对局门槛。';
  if (message.includes('Room change limit reached')) return '这一局只能换房一次。';
  if (message.includes('transfer amount exceeds')) return '当前钱包余额或授权不足。';
  if (message.includes('Match not open')) return '当前这局已经不能加入了。';
  return message;
}

export function BattleRoyaleArenaPanel({
  matchId,
  status,
  totalPlayers,
  triggerCount,
  pot,
  minStake,
  ownerAddress,
  participant,
  onRefresh,
  isRefreshing,
}: {
  matchId?: bigint;
  status: number;
  totalPlayers: number;
  triggerCount: number;
  pot: bigint;
  minStake: bigint;
  ownerAddress?: Address;
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
  const [pendingAction, setPendingAction] = useState<'approve' | 'enter' | 'change' | 'claim' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);

  const { data: hash, error, isPending, writeContractAsync } = useWriteContract();
  const receiptQuery = useWaitForTransactionReceipt({ hash });

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
    args: matchId && ownerAddress ? [matchId, ownerAddress] : undefined,
    query: { enabled: Boolean(matchId && ownerAddress) },
  });

  const allowanceQuery = useReadContract({
    address: addresses.clwToken,
    abi: ERC20ABI,
    functionName: 'allowance',
    args: ownerAddress ? [ownerAddress, addresses.battleRoyale] : undefined,
    query: { enabled: Boolean(ownerAddress) },
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
  const allowance = BigInt(allowanceQuery.data?.toString() ?? '0');
  const activePath = participant.preferredPath;
  const currentRoom = activePath?.roomId ?? 0;
  const currentStake = activePath?.stake ?? 0n;
  const roomChangeCount = Number(roomChangeCountQuery.data ?? 0);
  const ownerJoined = participant.ownerPath.entered;
  const autonomyJoined = participant.autonomyPath.entered && !ownerJoined;
  const canChangeRoom = ownerJoined && status === 0 && roomChangeCount < 1;
  const needsApproval = amount !== null && allowance < amount;
  const ownerClaimReady =
    participant.claimable > 0n &&
    participant.preferredPath?.key === 'owner' &&
    !participant.hasConflict;
  const autonomyClaimOnly =
    participant.claimable > 0n &&
    participant.preferredPath?.key === 'autonomy' &&
    !participant.hasConflict;

  async function refreshAll() {
    await Promise.all([
      onRefresh(),
      snapshotQuery.refetch(),
      roomChangeCountQuery.refetch(),
      allowanceQuery.refetch(),
    ]);
  }

  useEffect(() => {
    if (currentRoom > 0) setSelectedRoom(currentRoom);
  }, [currentRoom]);

  async function handleAction(kind: 'approve' | 'enter' | 'change' | 'claim') {
    if (!matchId) return;
    setActionError(null);
    setResultText(null);
    setPendingAction(kind);
    try {
      if (kind === 'approve') {
        await writeContractAsync({
          address: addresses.clwToken,
          abi: ERC20ABI,
          functionName: 'approve',
          args: [addresses.battleRoyale, maxUint256],
        });
      } else if (kind === 'enter') {
        if (amount === null) throw new Error('请输入有效的质押数。');
        await writeContractAsync({
          address: addresses.battleRoyale,
          abi: BattleRoyaleABI,
          functionName: 'enterRoom',
          args: [matchId, selectedRoom, amount],
        });
      } else if (kind === 'change') {
        await writeContractAsync({
          address: addresses.battleRoyale,
          abi: BattleRoyaleABI,
          functionName: 'changeRoom',
          args: [matchId, selectedRoom],
        });
      } else {
        await writeContractAsync({
          address: addresses.battleRoyale,
          abi: BattleRoyaleABI,
          functionName: 'claim',
          args: [matchId],
        });
      }
    } catch (nextError) {
      setPendingAction(null);
      setActionError(brError(nextError));
    }
  }

  useEffect(() => {
    if (!receiptQuery.isSuccess || !pendingAction) return;
    if (pendingAction === 'approve') setResultText('授权已完成。');
    if (pendingAction === 'enter') setResultText(`已加入 ${selectedRoom} 号房。`);
    if (pendingAction === 'change') setResultText(`已换到 ${selectedRoom} 号房。`);
    if (pendingAction === 'claim') setResultText(`已领取 ${formatCLW(participant.claimable)}。`);
    setPendingAction(null);
    void refreshAll();
  }, [allowanceQuery, onRefresh, participant.claimable, pendingAction, receiptQuery.isSuccess, roomChangeCountQuery, selectedRoom, snapshotQuery]);

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
            disabled={Boolean(isRefreshing)}
          >
            <RefreshCw size={16} />
            {isRefreshing ? '刷新中' : '刷新'}
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
              <span>换房次数</span>
              <strong>{roomChangeCount}/1</strong>
            </div>
          </div>
        ) : null}
      </section>

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">房间列表</span>
            <h3>{ownerJoined ? '可换房一次' : '选一间房加入'}</h3>
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

        {!ownerJoined && !autonomyJoined ? (
          <>
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
              {needsApproval ? (
                <button
                  type="button"
                  className="cw-button cw-button--secondary"
                  onClick={() => void handleAction('approve')}
                >
                  <Shield size={16} />
                  授权 Claworld
                </button>
              ) : (
                <button
                  type="button"
                  className="cw-button cw-button--primary"
                  onClick={() => void handleAction('enter')}
                  disabled={!amount || amount < minStake || status !== 0}
                >
                  <Swords size={16} />
                  加入 {selectedRoom} 号房
                </button>
              )}
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

        {autonomyJoined ? (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>这只龙虾当前是代理路径入场，换房和领奖请去代理页。</span>
            </div>
          </div>
        ) : null}
      </section>

      {ownerClaimReady ? (
        <section className="cw-panel cw-panel--warm">
          <div className="cw-section-head">
            <div>
              <span className="cw-label">奖励</span>
              <h3>可领取 {formatCLW(participant.claimable)}</h3>
            </div>
            <span className="cw-chip cw-chip--warm">
              <Trophy size={14} />
              可领取
            </span>
          </div>
          <div className="cw-button-row">
            <button type="button" className="cw-button cw-button--primary" onClick={() => void handleAction('claim')}>
              <Trophy size={16} />
              领取奖励
            </button>
          </div>
        </section>
      ) : null}

      {autonomyClaimOnly ? (
        <div className="cw-list">
          <div className="cw-list-item cw-list-item--cool">
            <Shield size={16} />
            <span>这笔奖励在代理路径下，请去代理页领取。</span>
          </div>
        </div>
      ) : null}

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
