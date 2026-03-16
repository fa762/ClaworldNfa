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

  const activeEventKeys = events ? parseActiveEvents(BigInt(events.toString())) : [];
  const loading = l1 || l2 || l3 || l4 || l5;

  return (
    <div className="bg-navy/50 rounded-xl border border-white/10 p-6">
      <h2 className="font-heading text-lg text-mythic-white mb-4">世界状态</h2>
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="奖励系数"
          value={rewardMul ? formatBasisPoints(rewardMul) : '--'}
          loading={l1}
        />
        <StatCard
          label="PK 质押上限"
          value={pkLimit ? formatCLW(pkLimit) + ' CLW' : '--'}
          loading={l2}
        />
        <StatCard
          label="变异概率加成"
          value={mutBonus ? formatBasisPoints(mutBonus) : '--'}
          loading={l3}
        />
        <StatCard
          label="日消耗系数"
          value={costMul ? formatBasisPoints(costMul) : '--'}
          loading={l4}
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
