'use client';

import { RARITY_NAMES_CN } from '@/lib/rarity';
import { SHELTER_NAMES } from '@/lib/shelter';

export interface Filters {
  rarity: number | null;
  shelter: number | null;
  status: 'all' | 'alive' | 'dormant';
  sortBy: 'id' | 'level' | 'rarity';
  sortDir: 'asc' | 'desc';
  myOnly: boolean;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  walletConnected: boolean;
}

export function FilterBar({ filters, onChange, walletConnected }: FilterBarProps) {
  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap gap-3 items-center mb-6">
      {/* Rarity */}
      <select
        value={filters.rarity ?? ''}
        onChange={(e) => update({ rarity: e.target.value === '' ? null : Number(e.target.value) })}
        className="bg-card-dark border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:border-abyss-orange outline-none"
      >
        <option value="">全部稀有度</option>
        {RARITY_NAMES_CN.map((name, i) => (
          <option key={i} value={i}>{name}</option>
        ))}
      </select>

      {/* Shelter */}
      <select
        value={filters.shelter ?? ''}
        onChange={(e) => update({ shelter: e.target.value === '' ? null : Number(e.target.value) })}
        className="bg-card-dark border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:border-abyss-orange outline-none"
      >
        <option value="">全部据点</option>
        {SHELTER_NAMES.map((name, i) => (
          <option key={i} value={i}>{name}</option>
        ))}
      </select>

      {/* Status */}
      <select
        value={filters.status}
        onChange={(e) => update({ status: e.target.value as Filters['status'] })}
        className="bg-card-dark border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:border-abyss-orange outline-none"
      >
        <option value="all">全部状态</option>
        <option value="alive">活跃</option>
        <option value="dormant">休眠</option>
      </select>

      {/* Sort */}
      <select
        value={`${filters.sortBy}-${filters.sortDir}`}
        onChange={(e) => {
          const [sortBy, sortDir] = e.target.value.split('-') as [Filters['sortBy'], Filters['sortDir']];
          update({ sortBy, sortDir });
        }}
        className="bg-card-dark border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:border-abyss-orange outline-none"
      >
        <option value="id-asc">ID 升序</option>
        <option value="id-desc">ID 降序</option>
        <option value="level-desc">等级 高→低</option>
        <option value="level-asc">等级 低→高</option>
        <option value="rarity-desc">稀有度 高→低</option>
        <option value="rarity-asc">稀有度 低→高</option>
      </select>

      {/* My lobsters toggle */}
      {walletConnected && (
        <button
          onClick={() => update({ myOnly: !filters.myOnly })}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            filters.myOnly
              ? 'bg-abyss-orange/20 border-abyss-orange text-abyss-orange'
              : 'border-white/10 text-gray-500 hover:text-white'
          }`}
        >
          我的龙虾
        </button>
      )}
    </div>
  );
}
