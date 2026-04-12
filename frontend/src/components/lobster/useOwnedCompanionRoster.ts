'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePublicClient } from 'wagmi';

import { ClawRouterABI } from '@/contracts/abis/ClawRouter';
import { addresses } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';
import { getLobsterName } from '@/lib/mockData';
import { getShelterName } from '@/lib/shelter';

type OwnedCompanionRosterItem = {
  tokenId: bigint;
  tokenNumber: number;
  name: string;
  shelterName: string;
  level: number;
  active: boolean;
  reserve: bigint;
  reserveText: string;
};

export function useOwnedCompanionRoster(ownedTokens: bigint[]) {
  const publicClient = usePublicClient();
  const [items, setItems] = useState<OwnedCompanionRosterItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const normalizedTokens = useMemo(
    () => [...ownedTokens].sort((left, right) => Number(left - right)),
    [ownedTokens],
  );

  useEffect(() => {
    let cancelled = false;

    if (!publicClient || normalizedTokens.length === 0) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    async function loadRoster() {
      const client = publicClient;
      if (!client) return;

      setIsLoading(true);

      try {
        const contracts = normalizedTokens.flatMap((tokenId) => [
          {
            address: addresses.clawRouter,
            abi: ClawRouterABI,
            functionName: 'getLobsterState' as const,
            args: [tokenId] as const,
          },
          {
            address: addresses.clawRouter,
            abi: ClawRouterABI,
            functionName: 'clwBalances' as const,
            args: [tokenId] as const,
          },
          {
            address: addresses.clawRouter,
            abi: ClawRouterABI,
            functionName: 'isActive' as const,
            args: [tokenId] as const,
          },
        ]);

        const results = await client.multicall({
          contracts,
          allowFailure: true,
        });

        if (cancelled) return;

        const nextItems = normalizedTokens.map((tokenId, index) => {
          const lobsterStateResult = results[index * 3];
          const reserveResult = results[index * 3 + 1];
          const activeResult = results[index * 3 + 2];

          const lobster = lobsterStateResult.status === 'success' ? (lobsterStateResult.result as any) : null;
          const reserve = reserveResult.status === 'success' ? BigInt(reserveResult.result as bigint) : 0n;
          const active = activeResult.status === 'success' ? Boolean(activeResult.result) : false;
          const tokenNumber = Number(tokenId);

          return {
            tokenId,
            tokenNumber,
            name: getLobsterName(tokenNumber),
            shelterName: getShelterName(Number(lobster?.shelter ?? lobster?.[1] ?? 0)),
            level: Number(lobster?.level ?? lobster?.[13] ?? 0),
            active,
            reserve,
            reserveText: formatCLW(reserve),
          };
        });

        setItems(nextItems);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadRoster();

    return () => {
      cancelled = true;
    };
  }, [normalizedTokens, publicClient]);

  return {
    items,
    isLoading,
  };
}
