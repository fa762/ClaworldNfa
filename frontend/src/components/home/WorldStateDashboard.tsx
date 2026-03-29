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
import { useI18n } from '@/lib/i18n';
import { useState } from 'react';
import { getBscScanAddressUrl } from '@/contracts/addresses';

const CLW_TOKEN_ADDRESS = '0x82404d91cd6b6cb16b58c650a26122bdc0af7777';

export function WorldStateDashboard() {
  const { t } = useI18n();
  const { data: rewardMul, isLoading: l1 } = useRewardMultiplier();
  const { data: pkLimit,   isLoading: l2 } = usePkStakeLimit();
  const { data: mutBonus,  isLoading: l3 } = useMutationBonus();
  const { data: costMul,   isLoading: l4 } = useDailyCostMultiplier();
  const { data: events,    isLoading: l5 } = useActiveEvents();
  const [copied, setCopied] = useState(false);

  const loading = l1 || l2 || l3 || l4 || l5;
  const activeEventKeys = events ? parseActiveEvents(BigInt(events.toString())) : [];

  const rows = [
    { label: t('world.rewardMul'), value: rewardMul ? formatBasisPoints(rewardMul) : '--' },
    { label: t('world.pkCap'),     value: pkLimit   ? formatCLW(pkLimit) + ' CLW'  : '--' },
    { label: t('world.mutBonus'),  value: mutBonus  ? formatBasisPoints(mutBonus)  : '--' },
    { label: t('world.dailyCost'), value: costMul   ? formatBasisPoints(costMul)   : '--' },
  ];

  const copyCA = () => {
    navigator.clipboard.writeText(CLW_TOKEN_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="term-box h-full flex flex-col" data-title={t('world.title')}>
      {loading ? (
        <div className="term-dim animate-glow-pulse text-xs">{t('loading')}</div>
      ) : (
        <>
          <div className="space-y-2 text-[11px] font-bold flex-1">
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
                      <span key={key} className={`ml-2 ${
                        info.color === 'text-red-400' ? 'term-danger'
                        : info.color === 'text-blue-400' ? 'rarity-rare'
                        : 'term-warn'}`}>
                        [{info.nameCN}]
                      </span>
                    ) : null;
                  })}
                </span>
              </div>
            )}
          </div>

          {/* CLW CA — 只显示合约地址，可复制 */}
          <div className="mt-3 pt-2 border-t border-crt-green/10 flex items-center justify-between gap-2">
            <span className="text-[9px] opacity-40 font-mono uppercase tracking-wider shrink-0">$CLW</span>
            <a
              href={getBscScanAddressUrl(CLW_TOKEN_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono opacity-50 hover:opacity-80 term-link truncate"
              title={CLW_TOKEN_ADDRESS}
            >
              {CLW_TOKEN_ADDRESS}
            </a>
            <button onClick={copyCA} className="text-[9px] term-link opacity-60 hover:opacity-100 shrink-0">
              {copied ? '[✓]' : '[CP]'}
            </button>
          </div>

          <div className="mt-1 text-[9px] opacity-30 animate-pulse">
            {t('world.sync')}
          </div>
        </>
      )}
    </div>
  );
}
