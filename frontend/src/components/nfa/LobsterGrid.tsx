'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { ClawNFAABI } from '@/contracts/abis/ClawNFA';
import { ClawRouterABI } from '@/contracts/abis/ClawRouter';
import { addresses } from '@/contracts/addresses';
import { LobsterCard, type LobsterCardData } from './LobsterCard';
import { FilterBar, type Filters } from './FilterBar';
import { useTokensOfOwner, useTotalSupply } from '@/contracts/hooks/useClawNFA';
import { isDemoMode } from '@/lib/env';
import { generateMockLobsters, getMockLobsterName } from '@/lib/mockData';
import { getRarityName, getRarityClass, getRarityStars } from '@/lib/rarity';
import { getShelterName } from '@/lib/shelter';
import { TerminalBox } from '@/components/terminal/TerminalBox';
import Link from 'next/link';

const defaultFilters: Filters = {
  rarity: null, shelter: null, status: 'all',
  sortBy: 'id', sortDir: 'asc', myOnly: false,
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const myTokenSet = useMemo(() => {
    if (!myTokens) return new Set<number>();
    return new Set((myTokens as bigint[]).map(Number));
  }, [myTokens]);

  useEffect(() => {
    if (isDemoMode) {
      setLobsters(generateMockLobsters());
      setUseMock(true);
      setLoading(false);
      return;
    }
    if (!publicClient || !totalSupply) { setLoading(false); return; }
    const count = Number(totalSupply);
    if (count === 0) { setLobsters([]); setLoading(false); return; }

    async function fetchAll() {
      setLoading(true);
      const BATCH_SIZE = 50;
      const allLobsters: LobsterCardData[] = [];
      for (let start = 1; start <= count; start += BATCH_SIZE) {
        const end = Math.min(start + BATCH_SIZE - 1, count);
        const ids = Array.from({ length: end - start + 1 }, (_, i) => BigInt(start + i));
        const calls = ids.flatMap((id) => [
          { address: addresses.clawNFA, abi: ClawNFAABI, functionName: 'getAgentState' as const, args: [id] as const },
          { address: addresses.clawNFA, abi: ClawNFAABI, functionName: 'getAgentMetadata' as const, args: [id] as const },
          { address: addresses.clawRouter, abi: ClawRouterABI, functionName: 'getLobsterState' as const, args: [id] as const },
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

  const filtered = useMemo(() => {
    let result = lobsters.map((l) => ({
      ...l,
      isOwned: useMock ? l.isOwned : myTokenSet.has(l.tokenId),
    }));
    if (filters.myOnly) result = result.filter((l) => l.isOwned);
    if (filters.rarity !== null) result = result.filter((l) => l.rarity === filters.rarity);
    if (filters.shelter !== null) result = result.filter((l) => l.shelter === filters.shelter);
    if (filters.status === 'alive') result = result.filter((l) => l.active);
    else if (filters.status === 'dormant') result = result.filter((l) => !l.active);
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
        <div className="text-xs rarity-epic mb-3">[DEMO MODE — 模拟数据]</div>
      )}

      <FilterBar
        filters={filters}
        onChange={setFilters}
        walletConnected={isConnected}
        viewMode={viewMode}
        onViewChange={setViewMode}
      />

      <div className="text-xs term-dim mb-3">
        &gt; 共 <span className="term-bright">{filtered.length}</span> 条记录
      </div>

      {loading ? (
        <div className="term-dim animate-glow-pulse py-8 text-center">
          LOADING DATABASE...
          <span className="animate-blink ml-1">█</span>
        </div>
      ) : filtered.length > 0 ? (
        viewMode === 'list' ? (
          /* TABLE VIEW */
          <TerminalBox title="NFA 数据库">
            <div className="overflow-x-auto">
              <table className="term-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>名称</th>
                    <th>等级</th>
                    <th>稀有度</th>
                    <th className="hidden sm:table-cell">据点</th>
                    <th>状态</th>
                    <th className="hidden sm:table-cell"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.tokenId} className="group">
                      <td>
                        <Link href={`/nfa/${l.tokenId}`} className="term-link">
                          #{String(l.tokenId).padStart(3, '0')}
                        </Link>
                      </td>
                      <td>
                        <span className="term-bright">{getMockLobsterName(l.tokenId)}</span>
                        {l.isOwned && <span className="ml-1 text-crt-bright glow-strong text-[10px]">[我]</span>}
                      </td>
                      <td className="term-dim">Lv.{l.level}</td>
                      <td>
                        <span className={getRarityClass(l.rarity)}>
                          {getRarityStars(l.rarity)}{getRarityName(l.rarity, true)}
                        </span>
                      </td>
                      <td className="term-dim hidden sm:table-cell">{getShelterName(l.shelter)}</td>
                      <td>
                        <span className={l.active ? 'status-alive' : 'status-dormant'}>
                          {l.active ? '●' : '○'}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell">
                        <Link href={`/nfa/${l.tokenId}`} className="term-link text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          [查看]
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TerminalBox>
        ) : (
          /* GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((l) => (
              <LobsterCard key={l.tokenId} data={l} />
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-16 term-dim">
          <div className="mb-2">{lobsters.length === 0 ? '暂无已铸造的龙虾' : '没有匹配的龙虾'}</div>
          <div className="term-darkest text-xs">{lobsters.length === 0 ? '龙虾铸造后将在此展示' : '尝试调整筛选条件'}</div>
        </div>
      )}
    </div>
  );
}
