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
  viewMode: 'list' | 'grid';
  onViewChange: (mode: 'list' | 'grid') => void;
}

export function FilterBar({ filters, onChange, walletConnected, viewMode, onViewChange }: FilterBarProps) {
  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs mb-4">
      <span className="term-dim">筛选:</span>

      <select
        value={filters.rarity ?? ''}
        onChange={(e) => update({ rarity: e.target.value === '' ? null : Number(e.target.value) })}
        className="term-select"
      >
        <option value="">全部稀有度</option>
        {RARITY_NAMES_CN.map((name, i) => (
          <option key={i} value={i}>{name}</option>
        ))}
      </select>

      <select
        value={filters.shelter ?? ''}
        onChange={(e) => update({ shelter: e.target.value === '' ? null : Number(e.target.value) })}
        className="term-select"
      >
        <option value="">全部据点</option>
        {SHELTER_NAMES.map((name, i) => (
          <option key={i} value={i}>{name}</option>
        ))}
      </select>

      <select
        value={filters.status}
        onChange={(e) => update({ status: e.target.value as Filters['status'] })}
        className="term-select"
      >
        <option value="all">全部状态</option>
        <option value="alive">活跃</option>
        <option value="dormant">休眠</option>
      </select>

      <select
        value={`${filters.sortBy}-${filters.sortDir}`}
        onChange={(e) => {
          const [sortBy, sortDir] = e.target.value.split('-') as [Filters['sortBy'], Filters['sortDir']];
          update({ sortBy, sortDir });
        }}
        className="term-select"
      >
        <option value="id-asc">ID ▲</option>
        <option value="id-desc">ID ▼</option>
        <option value="level-desc">等级 ▼</option>
        <option value="level-asc">等级 ▲</option>
        <option value="rarity-desc">稀有度 ▼</option>
        <option value="rarity-asc">稀有度 ▲</option>
      </select>

      {walletConnected && (
        <button
          onClick={() => update({ myOnly: !filters.myOnly })}
          className={`term-btn text-xs ${filters.myOnly ? 'term-btn-primary' : ''}`}
        >
          [{filters.myOnly ? '> 我的龙虾' : '我的龙虾'}]
        </button>
      )}

      <span className="term-darkest ml-auto hidden sm:inline">│</span>

      <div className="hidden sm:flex gap-1">
        <button
          onClick={() => onViewChange('list')}
          className={`text-xs px-2 py-0.5 ${viewMode === 'list' ? 'term-bright glow' : 'term-dim'}`}
        >
          [列表]
        </button>
        <button
          onClick={() => onViewChange('grid')}
          className={`text-xs px-2 py-0.5 ${viewMode === 'grid' ? 'term-bright glow' : 'term-dim'}`}
        >
          [网格]
        </button>
      </div>
    </div>
  );
}
