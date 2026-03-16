'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { usePublicClient } from 'wagmi';
import { ClawNFAABI } from '@/contracts/abis/ClawNFA';
import { ClawRouterABI } from '@/contracts/abis/ClawRouter';
import { addresses } from '@/contracts/addresses';
import { LobsterCard, type LobsterCardData } from './LobsterCard';
import { FilterBar, type Filters } from './FilterBar';
import { useTokensOfOwner, useTotalSupply } from '@/contracts/hooks/useClawNFA';
import { isDemoMode } from '@/lib/env';
import { generateMockLobsters } from '@/lib/mockData';

const defaultFilters: Filters = {
  rarity: null,
  shelter: null,
  status: 'all',
  sortBy: 'id',
  sortDir: 'asc',
  myOnly: false,
};

export function LobsterGrid() {
  const { address, isConnected } = useAccount();
  const { data: totalSupply } = useTotalSupply();
  const { data: myTokens } = useTokensOfOwner(address);
  const publicClient = usePublicClient();

  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [lobsters, setLobsters] = useState<LobsterCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);

  const myTokenSet = useMemo(() => {
    if (!myTokens) return new Set<number>();
    return new Set((myTokens as bigint[]).map(Number));
  }, [myTokens]);

  // Fetch all lobster data (or use mock)
  useEffect(() => {
    if (isDemoMode) {
      setLobsters(generateMockLobsters());
      setUseMock(true);
      setLoading(false);
      return;
    }

    if (!publicClient || !totalSupply) {
      setLoading(false);
      return;
    }

    const count = Number(totalSupply);
    if (count === 0) {
      setLobsters([]);
      setLoading(false);
      return;
    }

    async function fetchAll() {
      setLoading(true);
      const BATCH_SIZE = 50;
      const allLobsters: LobsterCardData[] = [];

      for (let start = 1; start <= count; start += BATCH_SIZE) {
        const end = Math.min(start + BATCH_SIZE - 1, count);
        const ids = Array.from({ length: end - start + 1 }, (_, i) => BigInt(start + i));

        const calls = ids.flatMap((id) => [
          {
            address: addresses.clawNFA,
            abi: ClawNFAABI,
            functionName: 'getAgentState' as const,
            args: [id] as const,
          },
          {
            address: addresses.clawNFA,
            abi: ClawNFAABI,
            functionName: 'getAgentMetadata' as const,
            args: [id] as const,
          },
          {
            address: addresses.clawRouter,
            abi: ClawRouterABI,
            functionName: 'getLobsterState' as const,
            args: [id] as const,
          },
        ]);

        try {
          const results = await publicClient!.multicall({ contracts: calls });

          for (let i = 0; i < ids.length; i++) {
            const agentState = results[i * 3];
            const agentMeta = results[i * 3 + 1];
            const lobsterState = results[i * 3 + 2];

            if (agentState.status !== 'success' || lobsterState.status !== 'success') continue;

            const state = agentState.result as any;
            const meta = agentMeta.status === 'success' ? (agentMeta.result as any) : null;
            const lobster = lobsterState.result as any;

            allLobsters.push({
              tokenId: Number(ids[i]),
              rarity: Number(lobster.rarity ?? lobster[0] ?? 0),
              shelter: Number(lobster.shelter ?? lobster[1] ?? 0),
              level: Number(lobster.level ?? lobster[11] ?? 0),
              active: Boolean(state.active ?? state[1]),
              vaultURI: meta?.vaultURI ?? meta?.[4] ?? '',
              isOwned: false,
            });
          }
        } catch (err) {
          console.error(`Failed to fetch batch ${start}-${end}:`, err);
        }
      }

      setLobsters(allLobsters);
      setLoading(false);
    }

    fetchAll();
  }, [publicClient, totalSupply]);

  // Apply filters and sorting
  const filtered = useMemo(() => {
    let result = lobsters.map((l) => ({
      ...l,
      isOwned: useMock ? l.isOwned : myTokenSet.has(l.tokenId),
    }));

    if (filters.myOnly) {
      result = result.filter((l) => l.isOwned);
    }
    if (filters.rarity !== null) {
      result = result.filter((l) => l.rarity === filters.rarity);
    }
    if (filters.shelter !== null) {
      result = result.filter((l) => l.shelter === filters.shelter);
    }
    if (filters.status === 'alive') {
      result = result.filter((l) => l.active);
    } else if (filters.status === 'dormant') {
      result = result.filter((l) => !l.active);
    }

    result.sort((a, b) => {
      const dir = filters.sortDir === 'asc' ? 1 : -1;
      switch (filters.sortBy) {
        case 'level': return (a.level - b.level) * dir;
        case 'rarity': return (a.rarity - b.rarity) * dir;
        default: return (a.tokenId - b.tokenId) * dir;
      }
    });

    return result;
  }, [lobsters, filters, myTokenSet, useMock]);

  return (
    <div>
      {useMock && (
        <div className="mb-5 px-4 py-2.5 bg-purple-500/[0.06] border border-purple-500/15 rounded-xl text-sm text-purple-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse-dot" />
          演示模式 — 显示模拟数据
        </div>
      )}
      <FilterBar filters={filters} onChange={setFilters} walletConnected={isConnected} />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card-dark rounded-xl border border-white/[0.04] animate-pulse">
              <div className="aspect-square bg-surface/50 rounded-t-xl" />
              <div className="p-3.5 space-y-2.5">
                <div className="flex justify-between">
                  <div className="h-4 w-12 bg-surface/50 rounded" />
                  <div className="h-4 w-10 bg-surface/50 rounded" />
                </div>
                <div className="flex gap-1.5">
                  <div className="h-5 w-14 bg-surface/50 rounded-full" />
                  <div className="h-5 w-16 bg-surface/50 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-gray-500">
              共 <span className="font-mono text-white">{filtered.length}</span> 只龙虾
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((l) => (
              <LobsterCard key={l.tokenId} data={l} />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-28">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">🦞</span>
          </div>
          <p className="text-gray-400 text-base mb-2 font-medium">
            {lobsters.length === 0 ? '暂无已铸造的龙虾' : '没有匹配的龙虾'}
          </p>
          <p className="text-gray-600 text-sm">
            {lobsters.length === 0 ? '龙虾铸造后将在此展示' : '尝试调整筛选条件查看更多'}
          </p>
        </div>
      )}
    </div>
  );
}
