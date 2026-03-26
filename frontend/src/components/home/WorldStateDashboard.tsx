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
import { useI18n } from '@/lib/i18n';

export function WorldStateDashboard() {
  const { t } = useI18n();
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
    { label: t('world.rewardMul'), value: useMock ? mockWorldState.rewardMultiplier : (rewardMul ? formatBasisPoints(rewardMul) : '--') },
    { label: t('world.pkCap'), value: useMock ? mockWorldState.pkStakeLimit : (pkLimit ? formatCLW(pkLimit) + ' CLW' : '--') },
    { label: t('world.mutBonus'), value: useMock ? mockWorldState.mutationBonus : (mutBonus ? formatBasisPoints(mutBonus) : '--') },
    { label: t('world.dailyCost'), value: useMock ? mockWorldState.dailyCostMultiplier : (costMul ? formatBasisPoints(costMul) : '--') },
  ];

  return (
    <div className="term-box h-full" data-title={t('world.title')}>
      {loading ? (
        <div className="term-dim animate-glow-pulse text-xs">{t('loading')}</div>
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
              <span className="opacity-60">{t('world.events')}</span>
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
            {t('world.sync')}
          </div>
        </div>
      )}
    </div>
  );
}
