'use client';

import { useCLWPrice } from '@/contracts/hooks/useWorldState';
import { useGraduated } from '@/contracts/hooks/useClawRouter';
import { addresses, getBscScanAddressUrl } from '@/contracts/addresses';
import { formatBNB, truncateAddress } from '@/lib/format';
import { Copy, ExternalLink, ArrowUpRight, Coins } from 'lucide-react';
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
    <div className="glass-card rounded-2xl p-6 scan-effect">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-tech-blue/10 flex items-center justify-center">
              <Coins size={16} className="text-tech-blue" />
            </div>
            <div>
              <h2 className="font-heading text-lg text-mythic-white">CLW 代币</h2>
              <p className="text-xs text-gray-600">Token Info</p>
            </div>
          </div>
          {useMock && (
            <span className="text-[10px] text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded-md border border-purple-500/20">DEMO</span>
          )}
        </div>

        <div className="space-y-3">
          {/* Price card */}
          <div className="bg-surface/50 rounded-xl p-5 border border-white/[0.04]">
            <p className="text-[11px] text-gray-500 mb-2">当前价格</p>
            {!useMock && priceLoading ? (
              <div className="h-9 w-32 bg-gray-800/50 animate-pulse rounded" />
            ) : (
              <p className="text-3xl font-mono font-bold text-gradient-blue tracking-tight">
                {useMock ? mockTokenInfo.price : (price ? `${formatBNB(price)} BNB` : '待部署')}
              </p>
            )}
          </div>

          {/* Status & Contract */}
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center justify-between bg-surface/50 rounded-xl px-4 py-3 border border-white/[0.04]">
              <span className="text-[11px] text-gray-500">状态</span>
              <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                isGraduated
                  ? 'bg-green-500/10 text-green-400 border border-green-500/15'
                  : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/15'
              }`}>
                {isGraduated ? '已毕业 · PancakeSwap' : '联合曲线 · Flap'}
              </span>
            </div>

            <div className="flex items-center justify-between bg-surface/50 rounded-xl px-4 py-3 border border-white/[0.04]">
              <span className="text-[11px] text-gray-500">合约</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono text-gray-400">
                  {useMock ? '待部署' : truncateAddress(addresses.clwToken)}
                </span>
                {!useMock && (
                  <>
                    <button
                      onClick={copyAddress}
                      className="p-1 rounded-md hover:bg-white/5 text-gray-600 hover:text-white transition-colors"
                      title="复制地址"
                    >
                      <Copy size={12} />
                    </button>
                    {copied && <span className="text-[10px] text-green-400">已复制</span>}
                    <a
                      href={getBscScanAddressUrl(addresses.clwToken)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-md hover:bg-white/5 text-gray-600 hover:text-tech-blue transition-colors"
                      title="BSCScan"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Buy CTA */}
          <a
            href={purchaseLink}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-2 w-full px-4 py-3.5 bg-gradient-to-r from-abyss-orange/15 to-abyss-orange/10 text-abyss-orange border border-abyss-orange/20 rounded-xl text-sm font-semibold hover:from-abyss-orange/25 hover:to-abyss-orange/15 hover:border-abyss-orange/35 transition-all active:scale-[0.98]"
          >
            购买 CLW
            <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
