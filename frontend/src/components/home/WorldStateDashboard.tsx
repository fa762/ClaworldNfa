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

export function WorldStateDashboard() {
  const { data: rewardMul, isLoading: l1 } = useRewardMultiplier();
  const { data: pkLimit, isLoading: l2 } = usePkStakeLimit();
  const { data: mutBonus, isLoading: l3 } = useMutationBonus();
  const { data: costMul, isLoading: l4 } = useDailyCostMultiplier();
  const { data: events, isLoading: l5 } = useActiveEvents();

  const useMock = isDemoMode;
  const loading = !useMock && (l1 || l2 || l3 || l4 || l5);

  const activeEventKeys = useMock
    ? mockWorldState.activeEvents
    : (events ? parseActiveEvents(BigInt(events.toString())) : []);

  const rows = [
    { label: 'REWARD MULTIPLIER', value: useMock ? mockWorldState.rewardMultiplier : (rewardMul ? formatBasisPoints(rewardMul) : '--') },
    { label: 'PK STAKE CAP', value: useMock ? mockWorldState.pkStakeLimit : (pkLimit ? formatCLW(pkLimit) + ' CLW' : '--') },
    { label: 'MUTATION BONUS', value: useMock ? mockWorldState.mutationBonus : (mutBonus ? formatBasisPoints(mutBonus) : '--') },
    { label: 'DAILY COST', value: useMock ? mockWorldState.dailyCostMultiplier : (costMul ? formatBasisPoints(costMul) : '--') },
  ];

  return (
    <div className="term-box" data-title="WORLD STATUS">
      {loading ? (
        <div className="term-dim animate-glow-pulse text-xs">LOADING...</div>
      ) : (
        <div className="space-y-2 text-[11px] font-bold">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between border-b border-crt-green/10 pb-1">
              <span className="opacity-60">{r.label}</span>
              <span className="term-bright">{r.value}</span>
            </div>
          ))}

          {activeEventKeys.length > 0 && (
            <div className="flex justify-between pt-1">
              <span className="opacity-60">EVENTS</span>
              <span>
                {activeEventKeys.map((key) => {
                  const info = getEventInfo(key);
                  return info ? (
                    <span key={key} className={`ml-2 ${info.color === 'text-red-400' ? 'term-danger' : info.color === 'text-blue-400' ? 'rarity-rare' : 'term-warn'}`}>
                      [{info.nameCN}]
                    </span>
                  ) : null;
                })}
              </span>
            </div>
          )}

          <div className="mt-3 text-[9px] opacity-40 animate-pulse">
            &gt; RUNNING WORLD_STATE_SYNC.EXE...
          </div>
        </div>
      )}
    </div>
  );
}
