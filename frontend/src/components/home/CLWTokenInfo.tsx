'use client';

import { useCLWPrice } from '@/contracts/hooks/useWorldState';
import { useGraduated } from '@/contracts/hooks/useClawRouter';
import { addresses, getBscScanAddressUrl } from '@/contracts/addresses';
import { formatBNB, truncateAddress } from '@/lib/format';
import { Copy, ExternalLink, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { isDemoMode } from '@/lib/env';
import { mockTokenInfo } from '@/lib/mockData';

export function CLWTokenInfo() {
  const { data: price, isLoading: priceLoading } = useCLWPrice();
  const { data: graduated } = useGraduated();
  const [copied, setCopied] = useState(false);

  const useMock = isDemoMode;

  const copyAddress = () => {
    navigator.clipboard.writeText(addresses.clwToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isGraduated = useMock ? mockTokenInfo.graduated : graduated;
  const purchaseLink = isGraduated
    ? `https://pancakeswap.finance/swap?outputCurrency=${addresses.clwToken}`
    : '#';

  return (
    <div className="glass-light rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-tech-blue" />
          <h2 className="font-heading text-lg text-mythic-white">CLW 代币</h2>
        </div>
        {useMock && (
          <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded">演示</span>
        )}
      </div>

      <div className="space-y-4">
        {/* Price */}
        <div className="bg-card-dark rounded-lg p-4 border border-white/5">
          <p className="text-xs text-gray-500 mb-1">当前价格</p>
          {!useMock && priceLoading ? (
            <div className="h-8 w-28 bg-gray-800 animate-pulse rounded" />
          ) : (
            <p className="text-2xl font-mono font-bold text-gradient-blue">
              {useMock ? mockTokenInfo.price : (price ? `${formatBNB(price)} BNB` : '待部署')}
            </p>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center justify-between bg-card-dark rounded-lg px-4 py-3 border border-white/5">
          <span className="text-xs text-gray-500">状态</span>
          <span className={`text-sm px-2.5 py-1 rounded-lg ${
            isGraduated
              ? 'bg-green-900/30 text-green-400 border border-green-500/20'
              : 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/20'
          }`}>
            {isGraduated ? '已毕业 (PancakeSwap)' : '联合曲线 (Flap)'}
          </span>
        </div>

        {/* Contract address */}
        <div className="flex items-center justify-between bg-card-dark rounded-lg px-4 py-3 border border-white/5">
          <span className="text-xs text-gray-500">合约</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-gray-400">
              {useMock ? '待部署' : truncateAddress(addresses.clwToken)}
            </span>
            {!useMock && (
              <>
                <button
                  onClick={copyAddress}
                  className="p-1 rounded hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
                  title="复制地址"
                >
                  <Copy size={13} />
                </button>
                {copied && <span className="text-xs text-green-400">已复制</span>}
                <a
                  href={getBscScanAddressUrl(addresses.clwToken)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-white/5 text-gray-500 hover:text-tech-blue transition-colors"
                  title="在 BSCScan 查看"
                >
                  <ExternalLink size={13} />
                </a>
              </>
            )}
          </div>
        </div>

        {/* Buy link */}
        <a
          href={purchaseLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-abyss-orange/15 text-abyss-orange border border-abyss-orange/25 rounded-xl text-sm font-medium hover:bg-abyss-orange/25 hover:border-abyss-orange/40 transition-all"
        >
          购买 CLW
          <ArrowUpRight size={16} />
        </a>
      </div>
    </div>
  );
}
