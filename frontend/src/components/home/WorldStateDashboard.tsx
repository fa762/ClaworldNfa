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
import { Activity, Trophy, Dna, Flame } from 'lucide-react';

const statIcons = [Trophy, Activity, Dna, Flame];
const statColors = [
  'text-tech-blue',
  'text-abyss-orange',
  'text-legend-gold',
  'text-red-400',
];

function StatCard({
  label,
  value,
  loading,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  loading: boolean;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-card-dark rounded-lg p-4 border border-white/5 card-hover group">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1 rounded ${color} bg-white/5`}>
          <Icon size={14} />
        </div>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      {loading ? (
        <div className="h-6 w-16 bg-gray-800 animate-pulse rounded" />
      ) : (
        <p className="text-lg font-mono text-white">{value}</p>
      )}
    </div>
  );
}

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
    {
      label: '奖励系数',
      value: useMock ? mockWorldState.rewardMultiplier : (rewardMul ? formatBasisPoints(rewardMul) : '--'),
    },
    {
      label: 'PK 质押上限',
      value: useMock ? mockWorldState.pkStakeLimit : (pkLimit ? formatCLW(pkLimit) + ' CLW' : '--'),
    },
    {
      label: '变异概率加成',
      value: useMock ? mockWorldState.mutationBonus : (mutBonus ? formatBasisPoints(mutBonus) : '--'),
    },
    {
      label: '日消耗系数',
      value: useMock ? mockWorldState.dailyCostMultiplier : (costMul ? formatBasisPoints(costMul) : '--'),
    },
  ];

  return (
    <div className="glass-light rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-abyss-orange" />
          <h2 className="font-heading text-lg text-mythic-white">世界状态</h2>
        </div>
        {useMock && (
          <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded">演示</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, i) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            loading={loading && !useMock}
            icon={statIcons[i]}
            color={statColors[i]}
          />
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/5">
        <p className="text-xs text-gray-500 mb-2">活跃事件</p>
        {loading ? (
          <div className="h-6 w-24 bg-gray-800 animate-pulse rounded" />
        ) : activeEventKeys.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activeEventKeys.map((key) => {
              const info = getEventInfo(key);
              return info ? (
                <span
                  key={key}
                  className={`text-sm px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 ${info.color}`}
                >
                  {info.nameCN}
                </span>
              ) : null;
            })}
          </div>
        ) : (
          <span className="text-sm text-gray-600">无活跃事件</span>
        )}
      </div>
    </div>
  );
}
