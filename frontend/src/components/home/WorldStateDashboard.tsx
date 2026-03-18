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
import { TerminalBox } from '@/components/terminal/TerminalBox';

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
    { label: '奖励系数', value: useMock ? mockWorldState.rewardMultiplier : (rewardMul ? formatBasisPoints(rewardMul) : '--') },
    { label: 'PK质押上限', value: useMock ? mockWorldState.pkStakeLimit : (pkLimit ? formatCLW(pkLimit) + ' CLW' : '--') },
    { label: '变异加成', value: useMock ? mockWorldState.mutationBonus : (mutBonus ? formatBasisPoints(mutBonus) : '--') },
    { label: '日消耗系数', value: useMock ? mockWorldState.dailyCostMultiplier : (costMul ? formatBasisPoints(costMul) : '--') },
  ];

  return (
    <TerminalBox title="世界状态">
      {loading ? (
        <div className="term-dim animate-glow-pulse">LOADING...</div>
      ) : (
        <div className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between">
              <span className="term-dim">{r.label}</span>
              <span className="term-bright">{r.value}</span>
            </div>
          ))}

          <div className="term-line my-2" />

          <div className="flex justify-between">
            <span className="term-dim">活跃事件</span>
            <span>
              {activeEventKeys.length > 0
                ? activeEventKeys.map((key) => {
                    const info = getEventInfo(key);
                    return info ? (
                      <span key={key} className={`ml-2 ${info.color === 'text-red-400' ? 'term-danger' : info.color === 'text-blue-400' ? 'rarity-rare' : 'term-warn'}`}>
                        [{info.nameCN}]
                      </span>
                    ) : null;
                  })
                : <span className="term-darkest">无</span>
              }
            </span>
          </div>
        </div>
      )}
    </TerminalBox>
  );
}
