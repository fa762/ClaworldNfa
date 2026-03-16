'use client';

import {
  useRewardMultiplier,
  usePkStakeLimit,
  useMutationBonus,
  useDailyCostMultiplier,
  useActiveEvents,
} from '@/contracts/hooks/useWorldState';
import { parseActiveEvents, getEventInfo } from '@/lib/events';
import { formatBasisPoints, formatCLW } from '@/lib/format';
import { isDemoMode } from '@/lib/env';
import { mockWorldState } from '@/lib/mockData';
import { Activity, Trophy, Dna, Flame, Radio } from 'lucide-react';

const statConfig = [
  { icon: Trophy, label: '奖励系数', color: 'text-tech-blue', barColor: 'bg-tech-blue' },
  { icon: Activity, label: 'PK 质押上限', color: 'text-abyss-orange', barColor: 'bg-abyss-orange' },
  { icon: Dna, label: '变异概率加成', color: 'text-legend-gold', barColor: 'bg-legend-gold' },
  { icon: Flame, label: '日消耗系数', color: 'text-red-400', barColor: 'bg-red-400' },
];

export function WorldStateDashboard() {
  const { data: rewardMul, isLoading: l1 } = useRewardMultiplier();
  const { data: pkLimit, isLoading: l2 } = usePkStakeLimit();
  const { data: mutBonus, isLoading: l3 } = useMutationBonus();
  const { data: costMul, isLoading: l4 } = useDailyCostMultiplier();
  const { data: events, isLoading: l5 } = useActiveEvents();

  const useMock = isDemoMode;

  const activeEventKeys = useMock
    ? mockWorldState.activeEvents
    : (events ? parseActiveEvents(BigInt(events.toString())) : []);
  const loading = !useMock && (l1 || l2 || l3 || l4 || l5);

  const stats = [
    { value: useMock ? mockWorldState.rewardMultiplier : (rewardMul ? formatBasisPoints(rewardMul) : '--') },
    { value: useMock ? mockWorldState.pkStakeLimit : (pkLimit ? formatCLW(pkLimit) + ' CLW' : '--') },
    { value: useMock ? mockWorldState.mutationBonus : (mutBonus ? formatBasisPoints(mutBonus) : '--') },
    { value: useMock ? mockWorldState.dailyCostMultiplier : (costMul ? formatBasisPoints(costMul) : '--') },
  ];

  return (
    <div className="glass-card rounded-2xl p-6 scan-effect">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-abyss-orange/10 flex items-center justify-center">
              <Radio size={16} className="text-abyss-orange" />
            </div>
            <div>
              <h2 className="font-heading text-lg text-mythic-white">世界状态</h2>
              <p className="text-xs text-gray-600">World State</p>
            </div>
          </div>
          {useMock && (
            <span className="text-[10px] text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded-md border border-purple-500/20">DEMO</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {statConfig.map((cfg, i) => (
            <div key={cfg.label} className="bg-surface/50 rounded-xl p-4 border border-white/[0.04] hover:border-white/[0.08] transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <cfg.icon size={14} className={cfg.color} />
                <span className="text-[11px] text-gray-500">{cfg.label}</span>
              </div>
              {loading ? (
                <div className="h-7 w-20 bg-gray-800/50 animate-pulse rounded" />
              ) : (
                <p className="text-xl font-mono font-bold text-white tracking-tight">{stats[i].value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Active events */}
        <div className="mt-5 pt-4 border-t border-white/[0.04]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-500">活跃事件</span>
            {activeEventKeys.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot" />
            )}
          </div>
          {loading ? (
            <div className="h-7 w-28 bg-gray-800/50 animate-pulse rounded" />
          ) : activeEventKeys.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeEventKeys.map((key) => {
                const info = getEventInfo(key);
                return info ? (
                  <span
                    key={key}
                    className={`text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] font-medium ${info.color}`}
                  >
                    {info.nameCN}
                  </span>
                ) : null;
              })}
            </div>
          ) : (
            <span className="text-xs text-gray-600">当前无活跃事件</span>
          )}
        </div>
      </div>
    </div>
  );
}
