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

function StatCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="bg-card-dark rounded-lg p-4 border border-white/5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {loading ? (
        <div className="h-6 w-16 bg-gray-800 animate-pulse rounded" />
      ) : (
        <p className="text-lg font-mono text-tech-blue">{value}</p>
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

  return (
    <div className="bg-navy/50 rounded-xl border border-white/10 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg text-mythic-white">世界状态</h2>
        {useMock && (
          <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded">演示</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="奖励系数"
          value={useMock ? mockWorldState.rewardMultiplier : (rewardMul ? formatBasisPoints(rewardMul) : '--')}
          loading={loading && !useMock}
        />
        <StatCard
          label="PK 质押上限"
          value={useMock ? mockWorldState.pkStakeLimit : (pkLimit ? formatCLW(pkLimit) + ' CLW' : '--')}
          loading={loading && !useMock}
        />
        <StatCard
          label="变异概率加成"
          value={useMock ? mockWorldState.mutationBonus : (mutBonus ? formatBasisPoints(mutBonus) : '--')}
          loading={loading && !useMock}
        />
        <StatCard
          label="日消耗系数"
          value={useMock ? mockWorldState.dailyCostMultiplier : (costMul ? formatBasisPoints(costMul) : '--')}
          loading={loading && !useMock}
        />
      </div>

      <div className="mt-4">
        <p className="text-xs text-gray-500 mb-2">活跃事件</p>
        {loading ? (
          <div className="h-6 w-24 bg-gray-800 animate-pulse rounded" />
        ) : activeEventKeys.length > 0 ? (
          <div className="flex gap-2">
            {activeEventKeys.map((key) => {
              const info = getEventInfo(key);
              return info ? (
                <span
                  key={key}
                  className={`text-sm px-2 py-0.5 rounded bg-white/5 ${info.color}`}
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
