'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Address } from 'viem';
import { usePublicClient } from 'wagmi';

import { deriveAutonomyParticipant } from '@/components/lobster/useBattleRoyaleParticipantState';
import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { addresses, chainId as appChainId } from '@/contracts/addresses';
import {
  loadPKResolutionCache,
  savePKResolutionCache,
  type CachedPKResolution,
} from '@/game/chain/contracts';
import { loadMatchResolution, loadRecentMatches } from '@/game/chain/wallet';

export type PkHistoryEntry = {
  matchId: number;
  role: '发起' | '应战';
  opponent: number;
  phase: number;
  stake: bigint;
  result: string;
  reward: bigint;
  txHash?: `0x${string}`;
};

export type BrHistoryEntry = {
  matchId: number;
  path: 'NFA 记账账户' | '持有人钱包';
  status: number;
  roomId: number;
  stake: bigint;
  claimable: bigint;
  claimed: boolean;
  pot: bigint;
  totalPlayers: number;
  losingRoom: number;
  result: string;
};

function pkPhaseText(phase: number) {
  if (phase === 0) return '等待应战';
  if (phase === 1) return '已匹配';
  if (phase === 2) return '等待亮招';
  if (phase === 3) return '可结算';
  if (phase === 4) return '已结算';
  if (phase === 5) return '已清局';
  return '未知';
}

function brResultText(
  status: number,
  roomId: number,
  losingRoom: number,
  claimable: bigint,
  claimed: boolean,
) {
  if (status === 0) return '开放中';
  if (status === 1) return '待揭示';
  if (roomId === 0) return '未参赛';
  if (roomId === losingRoom) return '出局';
  if (claimable > 0n) return '待领取';
  if (claimed) return '已领取';
  return '已结算';
}

function toTxHash(value: string | undefined): `0x${string}` | undefined {
  if (!value || !value.startsWith('0x')) return undefined;
  return value as `0x${string}`;
}

async function resolvePkHistory(tokenNumber: number) {
  const recent = await loadRecentMatches({ includeClosed: true, maxCount: 12 });
  const ownMatches = recent.filter(
    (match) => match.nfaA === tokenNumber || match.nfaB === tokenNumber,
  );

  const entries = await Promise.all(
    ownMatches.slice(0, 6).map(async (match) => {
      let resolution: CachedPKResolution | null = loadPKResolutionCache(match.matchId);
      if (!resolution && match.phase >= 4) {
        const settled = await loadMatchResolution(match.matchId, match.phaseTimestamp);
        if (settled?.type === 'settled') {
          resolution = {
            type: 'settled',
            matchId: settled.matchId,
            winnerNfaId: settled.winnerNfaId,
            loserNfaId: settled.loserNfaId,
            reward: settled.reward.toString(),
            burned: settled.burned.toString(),
            txHash: settled.transactionHash,
            ts: Date.now(),
          };
          savePKResolutionCache(resolution);
        } else if (settled?.type === 'cancelled') {
          resolution = {
            type: 'cancelled',
            matchId: settled.matchId,
            txHash: settled.transactionHash,
            ts: Date.now(),
          };
          savePKResolutionCache(resolution);
        }
      }

      const role = match.nfaA === tokenNumber ? '发起' : '应战';
      const opponent = match.nfaA === tokenNumber ? match.nfaB : match.nfaA;
      const reward =
        resolution?.type === 'settled' && resolution.winnerNfaId === tokenNumber
          ? BigInt(resolution.reward)
          : 0n;
      const result =
        resolution?.type === 'cancelled'
          ? '已清局'
          : resolution?.type === 'settled'
            ? resolution.winnerNfaId === tokenNumber
              ? '胜'
              : '败'
            : pkPhaseText(match.phase);

      return {
        matchId: match.matchId,
        role,
        opponent,
        phase: match.phase,
        stake: match.stake,
        result,
        reward,
        txHash:
          resolution?.type === 'settled'
            ? toTxHash(resolution.txHash)
            : resolution?.type === 'cancelled'
              ? toTxHash(resolution.txHash)
              : undefined,
      } satisfies PkHistoryEntry;
    }),
  );

  return entries;
}

export function useArenaHistory(tokenId: bigint | undefined, ownerAddress?: Address) {
  const publicClient = usePublicClient({ chainId: appChainId });
  const [pkHistory, setPkHistory] = useState<PkHistoryEntry[]>([]);
  const [brHistory, setBrHistory] = useState<BrHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tokenId || !publicClient) {
      setPkHistory([]);
      setBrHistory([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tokenNumber = Number(tokenId);
      const participant = deriveAutonomyParticipant(tokenId);
      const pkEntries = await resolvePkHistory(tokenNumber);

      const matchCountValue = (await publicClient.readContract({
        address: addresses.battleRoyale,
        abi: BattleRoyaleABI,
        functionName: 'matchCount',
      })) as bigint;

      const brEntries: BrHistoryEntry[] = [];
      const start = Math.max(1, Number(matchCountValue) - 11);

      for (let matchId = Number(matchCountValue); matchId >= start; matchId -= 1) {
        const matchInfo = (await publicClient.readContract({
          address: addresses.battleRoyale,
          abi: BattleRoyaleABI,
          functionName: 'getMatchInfo',
          args: [BigInt(matchId)],
        })) as readonly [number, number, bigint, number, bigint, bigint];

        const ownerPlayerInfo = ownerAddress
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'getPlayerInfo',
              args: [BigInt(matchId), ownerAddress],
            })) as readonly [number, bigint])
          : ([0, 0n] as const);

        const ownerClaimable = ownerAddress
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'getClaimable',
              args: [BigInt(matchId), ownerAddress],
            })) as bigint)
          : 0n;

        const ownerEffectiveNfa = ownerAddress
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'getEffectivePlayerNfa',
              args: [BigInt(matchId), ownerAddress],
            })) as bigint)
          : 0n;

        const ownerClaimed = ownerAddress
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'claimed',
              args: [BigInt(matchId), ownerAddress],
            })) as boolean)
          : false;

        const autoPlayerInfo = participant
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'getPlayerInfo',
              args: [BigInt(matchId), participant],
            })) as readonly [number, bigint])
          : ([0, 0n] as const);

        const autoClaimable = participant
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'getClaimable',
              args: [BigInt(matchId), participant],
            })) as bigint)
          : 0n;

        const autoEffectiveNfa = participant
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'getEffectivePlayerNfa',
              args: [BigInt(matchId), participant],
            })) as bigint)
          : 0n;

        const autoClaimed = participant
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'claimed',
              args: [BigInt(matchId), participant],
            })) as boolean)
          : false;

        const ownerPlayed =
          ownerEffectiveNfa === tokenId &&
          (Number(ownerPlayerInfo[0]) > 0 || ownerPlayerInfo[1] > 0n || ownerClaimable > 0n || ownerClaimed);
        const autoPlayed =
          autoEffectiveNfa === tokenId &&
          (Number(autoPlayerInfo[0]) > 0 || autoPlayerInfo[1] > 0n || autoClaimable > 0n || autoClaimed);

        if (!ownerPlayed && !autoPlayed) continue;

        const usingAuto = autoPlayed;
        const playerInfo = usingAuto ? autoPlayerInfo : ownerPlayerInfo;
        const claimable = usingAuto ? autoClaimable : ownerClaimable;
        const claimed = usingAuto ? autoClaimed : ownerClaimed;
        const roomId = Number(playerInfo[0] ?? 0);
        const losingRoom = Number(matchInfo[3] ?? 0);

        brEntries.push({
          matchId,
          path: usingAuto ? 'NFA 记账账户' : '持有人钱包',
          status: Number(matchInfo[0] ?? 0),
          totalPlayers: Number(matchInfo[1] ?? 0),
          losingRoom,
          pot: BigInt(matchInfo[4] ?? 0n),
          roomId,
          stake: BigInt(playerInfo[1] ?? 0n),
          claimable,
          claimed,
          result: brResultText(Number(matchInfo[0] ?? 0), roomId, losingRoom, claimable, claimed),
        });

        if (brEntries.length >= 6) break;
      }

      setPkHistory(pkEntries);
      setBrHistory(brEntries);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Arena history load failed.');
    } finally {
      setIsLoading(false);
    }
  }, [ownerAddress, publicClient, tokenId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    pkHistory,
    brHistory,
    isLoading,
    error,
    refresh,
  };
}
