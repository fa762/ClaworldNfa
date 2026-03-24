'use client';

import { useCLWPrice } from '@/contracts/hooks/useWorldState';
import { useGraduated } from '@/contracts/hooks/useClawRouter';
import { addresses, getBscScanAddressUrl } from '@/contracts/addresses';
import { formatBNB, truncateAddress, nativeSymbol } from '@/lib/format';
import { useState } from 'react';
import { isDemoMode } from '@/lib/env';
import { mockTokenInfo } from '@/lib/mockData';
import { useI18n } from '@/lib/i18n';

export function CLWTokenInfo() {
  const { t } = useI18n();
  const { data: price, isLoading: priceLoading } = useCLWPrice();
  const { data: graduated } = useGraduated();
  const [copied, setCopied] = useState(false);

  const useMock = isDemoMode;
  const isGraduated = useMock ? mockTokenInfo.graduated : graduated;

  const copyAddress = () => {
    navigator.clipboard.writeText(addresses.clwToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const purchaseLink = isGraduated
    ? `https://pancakeswap.finance/swap?outputCurrency=${addresses.clwToken}`
    : '#';

  return (
    <div className="term-box" data-title={t('token.title')}>
      <div className="flex flex-col justify-between h-full">
        <div>
          {/* Price display */}
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tighter mb-1 glow-strong">
            {!useMock && priceLoading ? (
              <span className="term-dim animate-glow-pulse text-lg">{t('loading')}</span>
            ) : (
              useMock ? mockTokenInfo.price : (price ? `${formatBNB(price)} ${nativeSymbol}` : '—')
            )}
          </div>
          <div className="text-[8px] opacity-30 break-all">
            {useMock ? '0xCLAW...F97A' : truncateAddress(addresses.clwToken)}
          </div>

          {/* Status */}
          <div className="mt-3 text-[11px] font-bold flex justify-between">
            <span className="opacity-60">{t('token.status')}</span>
            <span className={isGraduated ? 'text-crt-green' : 'term-warn'}>
              {isGraduated ? t('token.graduated') : t('token.bonding')}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <a
            href={purchaseLink}
            target="_blank"
            rel="noopener noreferrer"
            className="soft-key flex-1 text-center text-[10px]"
          >
            {t('token.trade')}
          </a>
          {!useMock && (
            <button onClick={copyAddress} className="soft-key text-[10px] px-3">
              {copied ? t('token.copied') : t('token.copy')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
