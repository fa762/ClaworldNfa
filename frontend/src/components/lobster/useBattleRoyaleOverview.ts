'use client';

import { useMemo } from 'react';
import { useReadContract } from 'wagmi';

import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { addresses } from '@/contracts/addresses';

const battleRoyaleContract = {
  address: addresses.battleRoyale,
  abi: BattleRoyaleABI,
} as const;

export function useBattleRoyaleOverview() {
  const latestOpenMatchQuery = useReadContract({
    ...battleRoyaleContract,
    functionName: 'latestOpenMatch',
    query: { enabled: Boolean(addresses.battleRoyale) },
  });

  const matchCountQuery = useReadContract({
    ...battleRoyaleContract,
    functionName: 'matchCount',
    query: { enabled: Boolean(addresses.battleRoyale) },
  });

  const latestOpenMatch = BigInt(latestOpenMatchQuery.data?.toString() ?? '0');
  const matchCount = BigInt(matchCountQuery.data?.toString() ?? '0');
  const targetMatchId = latestOpenMatch > 0n ? latestOpenMatch : matchCount > 0n ? matchCount : undefined;

  const matchInfoQuery = useReadContract({
    ...battleRoyaleContract,
    functionName: 'getMatchInfo',
    args: targetMatchId !== undefined ? [targetMatchId] : undefined,
    query: { enabled: targetMatchId !== undefined },
  });

  const matchConfigQuery = useReadContract({
    ...battleRoyaleContract,
    functionName: 'getMatchConfig',
    args: targetMatchId !== undefined ? [targetMatchId] : undefined,
    query: { enabled: targetMatchId !== undefined },
  });

  const matchSnapshotQuery = useReadContract({
    ...battleRoyaleContract,
    functionName: 'getMatchSnapshot',
    args: targetMatchId !== undefined ? [targetMatchId] : undefined,
    query: { enabled: targetMatchId !== undefined },
  });

  return useMemo(() => {
    const matchInfo = matchInfoQuery.data as readonly [number, number, bigint, number, bigint, bigint] | undefined;
    const matchConfig = matchConfigQuery.data as readonly [bigint, number, bigint, number] | undefined;
    const matchSnapshot = matchSnapshotQuery.data as readonly [readonly bigint[], readonly bigint[]] | undefined;

    const totalPlayers = Number(matchInfo?.[1] ?? 0);
    const status = Number(matchInfo?.[0] ?? 0);
    const revealBlock = BigInt(matchInfo?.[2] ?? 0n);
    const pot = BigInt(matchInfo?.[4] ?? 0n);
    const roundId = BigInt(matchInfo?.[5] ?? 0n);
    const minStake = BigInt(matchConfig?.[0] ?? 0n);
    const triggerCount = Number(matchConfig?.[1] ?? 0);
    const revealDelay = Number(matchConfig?.[3] ?? 0);
    const roomTotals = (matchSnapshot?.[1] ?? []) as readonly bigint[];
    const leadingRoom = roomTotals.reduce(
      (best, total, index) => (Number(total) > best.total ? { room: index + 1, total: Number(total) } : best),
      { room: 0, total: 0 }
    );

    return {
      ready: targetMatchId !== undefined,
      matchId: targetMatchId,
      latestOpenMatch,
      matchCount,
      isLoading:
        latestOpenMatchQuery.isLoading ||
        matchCountQuery.isLoading ||
        matchInfoQuery.isLoading ||
        matchConfigQuery.isLoading ||
        matchSnapshotQuery.isLoading,
      status,
      totalPlayers,
      revealBlock,
      pot,
      roundId,
      minStake,
      triggerCount,
      revealDelay,
      leadingRoom,
      hasOpenMatch: latestOpenMatch > 0n,
    };
  }, [
    latestOpenMatch,
    latestOpenMatchQuery.isLoading,
    matchConfigQuery.data,
    matchConfigQuery.isLoading,
    matchCount,
    matchCountQuery.isLoading,
    matchInfoQuery.data,
    matchInfoQuery.isLoading,
    matchSnapshotQuery.data,
    matchSnapshotQuery.isLoading,
    targetMatchId,
  ]);
}
