'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface StatItem {
  key: string;
  label: string;
  enLabel: string;
  value: number;
  max?: number;
}

interface PipBoyStatListProps {
  stats: StatItem[];
  /** 右侧附属内容（如龙虾图片） */
  sideContent?: React.ReactNode;
}

function getIndicator(value: number): { text: string; color: string } {
  if (value >= 70) return { text: '▲', color: 'text-crt-green glow' };
  if (value <= 25) return { text: '▼', color: 'term-danger' };
  return { text: ' ', color: '' };
}

export function PipBoyStatList({ stats, sideContent }: PipBoyStatListProps) {
  const [selected, setSelected] = useState(0);
  const current = stats[selected];
  const { t } = useI18n();

  return (
    <div className="flex flex-col sm:flex-row gap-4 p-2">
      {/* Left: stat list */}
      <div className="flex-1 min-w-0">
        {stats.map((stat, i) => (
          <div
            key={stat.key}
            className={`pipboy-stat-row ${i === selected ? 'pipboy-stat-active' : ''}`}
            onClick={() => setSelected(i)}
          >
            <span className="w-16 shrink-0 term-dim text-xs">{stat.label}</span>
            <span className="w-24 shrink-0 text-xs term-darkest">{stat.enLabel}</span>
            <span className={`w-6 text-right text-xs ${getIndicator(stat.value).color}`}>{getIndicator(stat.value).text}</span>
            <span className="w-8 text-right term-bright text-sm">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Right: image + description */}
      <div className="w-full sm:w-48 shrink-0 flex flex-col gap-3">
        {sideContent}
        {current && (
          <p className="text-xs term-dim leading-relaxed">
            {t(`stat.${current.key}`)}
          </p>
        )}
      </div>
    </div>
  );
}
