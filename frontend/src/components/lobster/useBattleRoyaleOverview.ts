'use client';

import { useCallback, useMemo } from 'react';
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

  const refresh = useCallback(async () => {
    await Promise.all([
      latestOpenMatchQuery.refetch(),
      matchCountQuery.refetch(),
      targetMatchId !== undefined ? matchInfoQuery.refetch() : Promise.resolve(),
      targetMatchId !== undefined ? matchConfigQuery.refetch() : Promise.resolve(),
      targetMatchId !== undefined ? matchSnapshotQuery.refetch() : Promise.resolve(),
    ]);
  }, [
    latestOpenMatchQuery,
    matchCountQuery,
    targetMatchId,
    matchInfoQuery,
    matchConfigQuery,
    matchSnapshotQuery,
  ]);

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
    const firstError =
      latestOpenMatchQuery.error ??
      matchCountQuery.error ??
      matchInfoQuery.error ??
      matchConfigQuery.error ??
      matchSnapshotQuery.error;

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
      isRefreshing:
        latestOpenMatchQuery.isRefetching ||
        matchCountQuery.isRefetching ||
        matchInfoQuery.isRefetching ||
        matchConfigQuery.isRefetching ||
        matchSnapshotQuery.isRefetching,
      hasError: Boolean(firstError),
      errorText: firstError instanceof Error ? firstError.message : null,
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
      refresh,
    };
  }, [
    latestOpenMatchQuery.error,
    latestOpenMatch,
    latestOpenMatchQuery.isLoading,
    latestOpenMatchQuery.isRefetching,
    matchConfigQuery.error,
    matchConfigQuery.data,
    matchConfigQuery.isLoading,
    matchConfigQuery.isRefetching,
    matchCountQuery.error,
    matchCount,
    matchCountQuery.isLoading,
    matchCountQuery.isRefetching,
    matchInfoQuery.error,
    matchInfoQuery.data,
    matchInfoQuery.isLoading,
    matchInfoQuery.isRefetching,
    matchSnapshotQuery.error,
    matchSnapshotQuery.data,
    matchSnapshotQuery.isLoading,
    matchSnapshotQuery.isRefetching,
    refresh,
    targetMatchId,
  ]);
}
