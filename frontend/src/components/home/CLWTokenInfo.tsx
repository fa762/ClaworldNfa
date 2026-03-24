'use client';

import { useCLWPrice } from '@/contracts/hooks/useWorldState';
import { useGraduated } from '@/contracts/hooks/useClawRouter';
import { addresses, getBscScanAddressUrl } from '@/contracts/addresses';
import { formatBNB, truncateAddress, nativeSymbol } from '@/lib/format';
import { useState } from 'react';
import { isDemoMode } from '@/lib/env';
import { mockTokenInfo } from '@/lib/mockData';
import { TerminalBox } from '@/components/terminal/TerminalBox';

export function CLWTokenInfo() {
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
    <TerminalBox title="CLW 代币">
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="term-dim">价格</span>
          {!useMock && priceLoading ? (
            <span className="term-dim animate-glow-pulse">LOADING...</span>
          ) : (
            <span className="term-bright glow-strong">
              {useMock ? mockTokenInfo.price : (price ? `${formatBNB(price)} ${nativeSymbol}` : '待部署')}
            </span>
          )}
        </div>

        <div className="flex justify-between">
          <span className="term-dim">状态</span>
          <span className={isGraduated ? 'text-crt-green' : 'term-warn'}>
            {isGraduated ? '已毕业 · PancakeSwap' : '联合曲线 · Flap'}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="term-dim">合约</span>
          <span className="flex items-center gap-2">
            {useMock ? (
              <span className="term-darkest">待部署</span>
            ) : (
              <>
                <a
                  href={getBscScanAddressUrl(addresses.clwToken)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="term-link text-xs"
                >
                  {truncateAddress(addresses.clwToken)}
                </a>
                <button onClick={copyAddress} className="term-link text-xs">
                  [{copied ? '已复制' : '复制'}]
                </button>
              </>
            )}
          </span>
        </div>

        <div className="term-line my-2" />

        <a
          href={purchaseLink}
          target="_blank"
          rel="noopener noreferrer"
          className="term-btn term-btn-primary text-xs block text-center"
        >
          [购买 CLW]
        </a>
      </div>
    </TerminalBox>
  );
}
