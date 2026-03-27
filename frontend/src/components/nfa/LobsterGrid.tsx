'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { ClawNFAABI } from '@/contracts/abis/ClawNFA';
import { ClawRouterABI } from '@/contracts/abis/ClawRouter';
import { addresses } from '@/contracts/addresses';
import { LobsterCard, type LobsterCardData } from './LobsterCard';
import { FilterBar, type Filters } from './FilterBar';
import { useTokensOfOwner, useTotalSupply } from '@/contracts/hooks/useClawNFA';
import { isTestnet } from '@/lib/env';
import { formatCompact } from '@/lib/format';
import { getLobsterName } from '@/lib/mockData';
import { getRarityName, getRarityClass, getRarityStars } from '@/lib/rarity';
import { getShelterName } from '@/lib/shelter';
import { TerminalBox } from '@/components/terminal/TerminalBox';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

const defaultFilters: Filters = {
  rarity: null, shelter: null, status: 'all',
  sortBy: 'id', sortDir: 'asc', myOnly: false,
};

const PAGE_SIZE = 50;

export function LobsterGrid() {
  const { address, isConnected } = useAccount();
  const { data: totalSupply } = useTotalSupply();
  const { data: myTokens } = useTokensOfOwner(address);
  const publicClient = usePublicClient();
  const { lang, t } = useI18n();

  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [lobsters, setLobsters] = useState<LobsterCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(1);

  const myTokenSet = useMemo(() => {
    if (!myTokens) return new Set<number>();
    return new Set((myTokens as bigint[]).map(Number));
  }, [myTokens]);

  useEffect(() => {
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
        const CALLS_PER_NFA = 4;
        const calls = ids.flatMap((id) => [
          { address: addresses.clawNFA, abi: ClawNFAABI, functionName: 'getAgentState' as const, args: [id] as const },
          { address: addresses.clawNFA, abi: ClawNFAABI, functionName: 'getAgentMetadata' as const, args: [id] as const },
          { address: addresses.clawRouter, abi: ClawRouterABI, functionName: 'getLobsterState' as const, args: [id] as const },
          { address: addresses.clawRouter, abi: ClawRouterABI, functionName: 'clwBalances' as const, args: [id] as const },
        ]);
        try {
          const results = await publicClient!.multicall({ contracts: calls });

          for (let i = 0; i < ids.length; i++) {
            const agentState = results[i * CALLS_PER_NFA];
            const agentMeta = results[i * CALLS_PER_NFA + 1];
            const lobsterState = results[i * CALLS_PER_NFA + 2];
            const clwRes = results[i * CALLS_PER_NFA + 3];
            if (agentState.status !== 'success' || lobsterState.status !== 'success') continue;
            const state = agentState.result as any;
            const metaRaw = agentMeta.status === 'success' ? (agentMeta.result as any) : null;
            // wagmi wraps struct in Array — unwrap
            const meta = Array.isArray(metaRaw) ? metaRaw[0] : metaRaw;
            const lobster = lobsterState.result as any;
            const clwRaw = clwRes.status === 'success' ? (clwRes.result as bigint) : 0n;
            const tokenId = Number(ids[i]);

            // Agent BNB balance from getAgentState[0] (on-chain balance held by NFA contract)
            const agentBnbRaw = BigInt(state.balance ?? state[0] ?? 0);

            // Format: CLW with commas, BNB to 4 decimals
            const clwFormatted = Number(clwRaw / 10n**14n) / 10000;  // 18 decimals → 4 dp
            const bnbFormatted = Number(agentBnbRaw / 10n**14n) / 10000;

            allLobsters.push({
              tokenId,
              rarity: Number(lobster.rarity ?? lobster[0] ?? 0),
              shelter: Number(lobster.shelter ?? lobster[1] ?? 0),
              level: Number(lobster.level ?? lobster[11] ?? 0),
              active: Boolean(state.active ?? state[1]),
              vaultURI: meta?.vaultURI ?? meta?.[4] ?? '',
              isOwned: false,
              clwBalance: clwFormatted > 0 ? formatCompact(clwFormatted) : undefined,
              ownerBnb: bnbFormatted > 0 ? formatCompact(bnbFormatted) : undefined,
              clwRaw: clwFormatted,
              bnbRaw: bnbFormatted,
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
      isOwned: myTokenSet.has(l.tokenId),
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
        case 'clw': return ((a.clwRaw ?? 0) - (b.clwRaw ?? 0)) * dir;
        case 'bnb': return ((a.bnbRaw ?? 0) - (b.bnbRaw ?? 0)) * dir;
        default: return (a.tokenId - b.tokenId) * dir;
      }
    });
    return result;
  }, [lobsters, filters, myTokenSet]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Reset to page 1 when filters change
  const filtersKey = JSON.stringify(filters);
  useMemo(() => setPage(1), [filtersKey]);

  const isCN = lang === 'zh';

  return (
    <div>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        walletConnected={isConnected}
        viewMode={viewMode}
        onViewChange={setViewMode}
      />

      <div className="text-xs term-dim mb-3 flex items-center gap-4">
        <span>&gt; {t('nfa.total')} <span className="term-bright">{filtered.length}</span> {t('nfa.records')}</span>
        {totalPages > 1 && (
          <span className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="term-link disabled:term-darkest">[&lt;]</button>
            <span className="term-bright">{page}</span>/<span>{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="term-link disabled:term-darkest">[&gt;]</button>
          </span>
        )}
      </div>

      {loading ? (
        <div className="term-dim animate-glow-pulse py-8 text-center">
          {t('loading.db')}
          <span className="animate-blink ml-1">█</span>
        </div>
      ) : paged.length > 0 ? (
        viewMode === 'list' ? (
          /* TABLE VIEW */
          <TerminalBox title={t('nfa.database')}>
            <div className="overflow-x-auto">
              <table className="term-table">
                <thead>
                  <tr>
                    <th>{t('th.id')}</th>
                    <th>{t('th.name')}</th>
                    <th>{t('th.level')}</th>
                    <th>{t('th.rarity')}</th>
                    <th className="hidden sm:table-cell">{t('th.shelter')}</th>
                    <th className="hidden md:table-cell">CLW</th>
                    <th className="hidden md:table-cell">{isTestnet ? 'tBNB' : 'BNB'}</th>
                    <th>{t('th.status')}</th>
                    <th className="hidden sm:table-cell"></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((l) => (
                    <tr key={l.tokenId} className="group cursor-pointer" onClick={() => window.location.href = `/nfa/${l.tokenId}`}>
                      <td>
                        <Link href={`/nfa/${l.tokenId}`} className="term-link">
                          #{String(l.tokenId).padStart(3, '0')}
                        </Link>
                      </td>
                      <td>
                        <span className="term-bright">{getLobsterName(l.tokenId)}</span>
                        {l.isOwned && <span className="ml-1 text-crt-bright glow-strong text-[10px]">[{t('nfa.mine')}]</span>}
                      </td>
                      <td className="term-dim">Lv.{l.level}</td>
                      <td>
                        <span className={getRarityClass(l.rarity)}>
                          {getRarityStars(l.rarity)}{getRarityName(l.rarity, isCN)}
                        </span>
                      </td>
                      <td className="term-dim hidden sm:table-cell">{getShelterName(l.shelter)}</td>
                      <td className="term-dim hidden md:table-cell">{l.clwBalance ? `${l.clwBalance}` : '-'}</td>
                      <td className="term-dim hidden md:table-cell">{l.ownerBnb ? `${l.ownerBnb}` : '-'}</td>
                      <td>
                        <span className={l.active ? 'status-alive' : 'status-dormant'}>
                          {l.active ? '●' : '○'}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell">
                        <Link href={`/nfa/${l.tokenId}`} className="term-link text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          [{t('nfa.view')}]
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
            {paged.map((l) => (
              <LobsterCard key={l.tokenId} data={l} />
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-16 term-dim">
          <div className="mb-2">{lobsters.length === 0 ? t('nfa.empty') : t('nfa.noMatch')}</div>
          <div className="term-darkest text-xs">{lobsters.length === 0 ? t('nfa.emptyHint') : t('nfa.noMatchHint')}</div>
        </div>
      )}
    </div>
  );
}
