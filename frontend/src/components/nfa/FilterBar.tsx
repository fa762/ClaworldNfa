'use client';

import { RARITY_NAMES_CN, RARITY_NAMES } from '@/lib/rarity';
import { SHELTER_NAMES } from '@/lib/shelter';
import { useI18n } from '@/lib/i18n';

export interface Filters {
  rarity: number | null;
  shelter: number | null;
  status: 'all' | 'alive' | 'dormant';
  sortBy: 'id' | 'level' | 'rarity' | 'clw' | 'bnb';
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
  const { lang, t } = useI18n();
  const rarityNames = lang === 'zh' ? RARITY_NAMES_CN : RARITY_NAMES;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs mb-4">
      <span className="term-dim">{t('filter.label')}</span>

      <select
        value={filters.rarity ?? ''}
        onChange={(e) => update({ rarity: e.target.value === '' ? null : Number(e.target.value) })}
        className="term-select"
      >
        <option value="">{t('filter.allRarity')}</option>
        {rarityNames.map((name, i) => (
          <option key={i} value={i}>{name}</option>
        ))}
      </select>

      <select
        value={filters.shelter ?? ''}
        onChange={(e) => update({ shelter: e.target.value === '' ? null : Number(e.target.value) })}
        className="term-select"
      >
        <option value="">{t('filter.allShelter')}</option>
        {SHELTER_NAMES.map((name, i) => (
          <option key={i} value={i}>{name}</option>
        ))}
      </select>

      <select
        value={filters.status}
        onChange={(e) => update({ status: e.target.value as Filters['status'] })}
        className="term-select"
      >
        <option value="all">{t('filter.allStatus')}</option>
        <option value="alive">{t('filter.alive')}</option>
        <option value="dormant">{t('filter.dormant')}</option>
      </select>

      <select
        value={`${filters.sortBy}-${filters.sortDir}`}
        onChange={(e) => {
          const [sortBy, sortDir] = e.target.value.split('-') as [Filters['sortBy'], Filters['sortDir']];
          update({ sortBy, sortDir });
        }}
        className="term-select"
      >
        <option value="id-asc">{t('filter.idAsc')}</option>
        <option value="id-desc">{t('filter.idDesc')}</option>
        <option value="level-desc">{t('filter.levelDesc')}</option>
        <option value="level-asc">{t('filter.levelAsc')}</option>
        <option value="rarity-desc">{t('filter.rarityDesc')}</option>
        <option value="rarity-asc">{t('filter.rarityAsc')}</option>
        <option value="clw-desc">CLW ↓</option>
        <option value="clw-asc">CLW ↑</option>
        <option value="bnb-desc">BNB ↓</option>
        <option value="bnb-asc">BNB ↑</option>
      </select>

      {walletConnected && (
        <button
          onClick={() => update({ myOnly: !filters.myOnly })}
          className={`term-btn text-xs ${filters.myOnly ? 'term-btn-primary' : ''}`}
        >
          [{filters.myOnly ? '> ' : ''}{t('filter.myLobster')}]
        </button>
      )}

      <span className="term-darkest ml-auto">│</span>

      <div className="flex gap-1">
        <button
          onClick={() => onViewChange('list')}
          className={`text-xs px-2 py-0.5 ${viewMode === 'list' ? 'term-bright glow' : 'term-dim'}`}
        >
          [{t('filter.list')}]
        </button>
        <button
          onClick={() => onViewChange('grid')}
          className={`text-xs px-2 py-0.5 ${viewMode === 'grid' ? 'term-bright glow' : 'term-dim'}`}
        >
          [{t('filter.grid')}]
        </button>
      </div>
    </div>
  );
}
