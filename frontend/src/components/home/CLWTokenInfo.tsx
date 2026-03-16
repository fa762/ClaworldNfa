'use client';

import { useCLWPrice } from '@/contracts/hooks/useWorldState';
import { useGraduated } from '@/contracts/hooks/useClawRouter';
import { addresses, getBscScanAddressUrl } from '@/contracts/addresses';
import { formatBNB, truncateAddress } from '@/lib/format';
import { Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export function CLWTokenInfo() {
  const { data: price, isLoading: priceLoading } = useCLWPrice();
  const { data: graduated } = useGraduated();
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(addresses.clwToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const purchaseLink = graduated
    ? `https://pancakeswap.finance/swap?outputCurrency=${addresses.clwToken}`
    : '#'; // Flap platform link

  return (
    <div className="bg-navy/50 rounded-xl border border-white/10 p-6">
      <h2 className="font-heading text-lg text-mythic-white mb-4">CLW 代币</h2>

      <div className="space-y-4">
        {/* Price */}
        <div className="bg-card-dark rounded-lg p-4 border border-white/5">
          <p className="text-xs text-gray-500 mb-1">当前价格</p>
          {priceLoading ? (
            <div className="h-6 w-24 bg-gray-800 animate-pulse rounded" />
          ) : (
            <p className="text-lg font-mono text-tech-blue">
              {price ? `${formatBNB(price)} BNB` : '待部署'}
            </p>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">状态：</span>
          <span className={`text-sm px-2 py-0.5 rounded ${
            graduated
              ? 'bg-green-900/50 text-green-400'
              : 'bg-yellow-900/50 text-yellow-400'
          }`}>
            {graduated ? '已毕业 (PancakeSwap)' : '联合曲线 (Flap)'}
          </span>
        </div>

        {/* Contract address */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">合约：</span>
          <span className="text-sm font-mono text-gray-400">
            {truncateAddress(addresses.clwToken)}
          </span>
          <button onClick={copyAddress} className="text-gray-500 hover:text-white transition-colors">
            <Copy size={14} />
          </button>
          {copied && <span className="text-xs text-green-400">已复制</span>}
          <a
            href={getBscScanAddressUrl(addresses.clwToken)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-tech-blue transition-colors"
          >
            <ExternalLink size={14} />
          </a>
        </div>

        {/* Buy link */}
        <a
          href={purchaseLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-abyss-orange/20 text-abyss-orange border border-abyss-orange/30 rounded-lg text-sm hover:bg-abyss-orange/30 transition-colors"
        >
          购买 CLW →
        </a>
      </div>
    </div>
  );
}
