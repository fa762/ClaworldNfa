'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { usePublicClient } from 'wagmi';
import { ClawNFAABI } from '@/contracts/abis/ClawNFA';
import { ClawRouterABI } from '@/contracts/abis/ClawRouter';
import { addresses } from '@/contracts/addresses';
import { zeroAddress } from 'viem';
import { LobsterCard, type LobsterCardData } from './LobsterCard';
import { FilterBar, type Filters } from './FilterBar';
import { useTokensOfOwner, useTotalSupply } from '@/contracts/hooks/useClawNFA';

const defaultFilters: Filters = {
  rarity: null,
  shelter: null,
  status: 'all',
  sortBy: 'id',
  sortDir: 'asc',
  myOnly: false,
};

// Mock data for preview when no contracts are deployed
function generateMockLobsters(): LobsterCardData[] {
  const names = ['问号', '奇点', '课本', '计时', '锈钉', '回声', '静电', '脉冲'];
  const mocks: LobsterCardData[] = [];

  // Mythic (1)
  mocks.push({ tokenId: 1, rarity: 4, shelter: 7, level: 50, active: true, vaultURI: '', isOwned: false });
  // Legendary (4)
  for (let i = 2; i <= 5; i++) {
    mocks.push({ tokenId: i, rarity: 3, shelter: i % 8, level: 30 + i * 3, active: true, vaultURI: '', isOwned: i === 2 });
  }
  // Epic (6)
  for (let i = 6; i <= 11; i++) {
    mocks.push({ tokenId: i, rarity: 2, shelter: i % 8, level: 15 + i * 2, active: i % 3 !== 0, vaultURI: '', isOwned: false });
  }
  // Rare (17)
  for (let i = 12; i <= 28; i++) {
    mocks.push({ tokenId: i, rarity: 1, shelter: i % 8, level: 5 + (i % 20), active: i % 4 !== 0, vaultURI: '', isOwned: i === 15 || i === 22 });
  }
  // Common (fill to 48 for preview)
  for (let i = 29; i <= 48; i++) {
    mocks.push({ tokenId: i, rarity: 0, shelter: i % 8, level: 1 + (i % 10), active: i % 5 !== 0, vaultURI: '', isOwned: false });
  }

  return mocks;
}

const isContractDeployed = !!addresses.clawNFA && addresses.clawNFA !== zeroAddress;

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
    if (!isContractDeployed) {
      setLobsters(generateMockLobsters());
      setUseMock(true);
      setLoading(false);
      return;
    }

    if (!publicClient || !totalSupply) return;

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
      isOwned: myTokenSet.has(l.tokenId),
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
  }, [lobsters, filters, myTokenSet]);

  return (
    <div>
      {useMock && (
        <div className="mb-4 px-4 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-sm text-yellow-400">
          预览模式 — 显示模拟数据。部署合约并配置 .env.local 后将显示真实链上数据。
        </div>
      )}
      <FilterBar filters={filters} onChange={setFilters} walletConnected={isConnected} />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card-dark rounded-xl border border-white/10 animate-pulse">
              <div className="aspect-square bg-gray-800 rounded-t-xl" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-16 bg-gray-800 rounded" />
                <div className="h-4 w-32 bg-gray-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
          <p className="text-sm text-gray-500 mb-4">{filtered.length} 只龙虾</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((l) => (
              <LobsterCard key={l.tokenId} data={l} />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-gray-500">
          {lobsters.length === 0 ? '暂无已铸造的龙虾' : '没有匹配的龙虾'}
        </div>
      )}
    </div>
  );
}
