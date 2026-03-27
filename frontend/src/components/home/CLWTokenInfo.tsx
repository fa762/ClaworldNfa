'use client';

import { useReadContract } from 'wagmi';
import { useCLWPrice } from '@/contracts/hooks/useWorldState';
import { useGraduated } from '@/contracts/hooks/useClawRouter';
import { addresses, getBscScanAddressUrl } from '@/contracts/addresses';
import { formatBNB, formatCLW, truncateAddress, nativeSymbol } from '@/lib/format';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { ERC20ABI } from '@/contracts/abis/ERC20';
import { type Address, zeroAddress } from 'viem';

const CLW_TOKEN_ADDRESS = '0x82404d91cd6b6cb16b58c650a26122bdc0af7777' as Address;

export function CLWTokenInfo() {
  const { t } = useI18n();
  const { data: price, isLoading: priceLoading } = useCLWPrice();
  const { data: graduated } = useGraduated();
  const [copied, setCopied] = useState(false);

  const isTokenDeployed = !!CLW_TOKEN_ADDRESS && CLW_TOKEN_ADDRESS !== zeroAddress;

  const { data: clwTotalSupply } = useReadContract({
    address: CLW_TOKEN_ADDRESS,
    abi: ERC20ABI,
    functionName: 'totalSupply',
    query: { enabled: isTokenDeployed },
  });

  const isGraduated = graduated;

  const copyAddress = () => {
    navigator.clipboard.writeText(CLW_TOKEN_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const purchaseLink = isGraduated
    ? `https://pancakeswap.finance/swap?outputCurrency=${CLW_TOKEN_ADDRESS}`
    : '#';

  return (
    <div className="term-box" data-title={t('token.title')}>
      <div className="flex flex-col justify-between h-full">
        <div>
          {/* Price display */}
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tighter mb-1 glow-strong">
            {priceLoading ? (
              <span className="term-dim animate-glow-pulse text-lg">{t('loading')}</span>
            ) : (
              price ? `${formatBNB(price)} ${nativeSymbol}` : '--'
            )}
          </div>
          <div className="text-[8px] opacity-30 break-all">
            {truncateAddress(CLW_TOKEN_ADDRESS)}
          </div>

          {/* Total Supply */}
          {clwTotalSupply !== undefined && (
            <div className="mt-2 text-[11px] font-bold flex justify-between">
              <span className="opacity-60">{t('token.supply') || 'Total Supply'}</span>
              <span className="term-bright">{formatCLW(clwTotalSupply as bigint)} CLW</span>
            </div>
          )}

          {/* Status */}
          <div className="mt-2 text-[11px] font-bold flex justify-between">
            <span className="opacity-60">{t('token.status')}</span>
            <span className={isGraduated ? 'text-crt-green' : 'term-warn'}>
              {isGraduated ? t('token.graduated') : t('token.bonding')}
            </span>
          </div>

          {/* Contract link */}
          <div className="mt-1 text-[11px] font-bold flex justify-between">
            <span className="opacity-60">{t('token.contract') || 'Contract'}</span>
            <a
              href={getBscScanAddressUrl(CLW_TOKEN_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="term-link text-[10px]"
            >
              {truncateAddress(CLW_TOKEN_ADDRESS)}
            </a>
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
          <button onClick={copyAddress} className="soft-key text-[10px] px-3">
            {copied ? t('token.copied') : t('token.copy')}
          </button>
        </div>
      </div>
    </div>
  );
}
