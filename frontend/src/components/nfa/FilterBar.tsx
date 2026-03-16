'use client';

import { RARITY_NAMES_CN } from '@/lib/rarity';
import { SHELTER_NAMES } from '@/lib/shelter';
import { SlidersHorizontal } from 'lucide-react';

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

const selectClass = 'bg-card-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:border-abyss-orange/50 focus:ring-1 focus:ring-abyss-orange/20 outline-none transition-all hover:border-white/20';

export function FilterBar({ filters, onChange, walletConnected }: FilterBarProps) {
  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="glass-light rounded-xl p-4 mb-6">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-xs text-gray-500 mr-1">
          <SlidersHorizontal size={14} />
          <span className="hidden sm:inline">筛选</span>
        </div>

        {/* Rarity */}
        <select
          value={filters.rarity ?? ''}
          onChange={(e) => update({ rarity: e.target.value === '' ? null : Number(e.target.value) })}
          className={selectClass}
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
          className={selectClass}
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
          className={selectClass}
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
          className={selectClass}
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
            className={`px-3 py-2 text-sm rounded-lg border transition-all ${
              filters.myOnly
                ? 'bg-abyss-orange/20 border-abyss-orange/50 text-abyss-orange shadow-[0_0_10px_rgba(232,115,74,0.1)]'
                : 'border-white/10 text-gray-500 hover:text-white hover:border-white/20'
            }`}
          >
            我的龙虾
          </button>
        )}
      </div>
    </div>
  );
}
