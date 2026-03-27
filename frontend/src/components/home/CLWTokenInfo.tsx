'use client';

import { useReadContract, useBalance } from 'wagmi';
import { useGraduated } from '@/contracts/hooks/useClawRouter';
import { addresses, getBscScanAddressUrl } from '@/contracts/addresses';
import { formatCLW, truncateAddress, nativeSymbol } from '@/lib/format';
import { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { ERC20ABI } from '@/contracts/abis/ERC20';
import { type Address, zeroAddress, formatEther } from 'viem';

const CLW_TOKEN_ADDRESS = '0x82404d91cd6b6cb16b58c650a26122bdc0af7777' as Address;
const FLAP_CONTRACT = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0' as Address;

export function CLWTokenInfo() {
  const { t } = useI18n();
  const { data: graduated } = useGraduated();

  // Read Flap contract balances to calculate price
  const { data: flapBnbBalance } = useBalance({ address: FLAP_CONTRACT });
  const { data: flapClwBalance } = useReadContract({
    address: CLW_TOKEN_ADDRESS,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: [FLAP_CONTRACT],
  });

  const price = useMemo(() => {
    if (!flapBnbBalance?.value || !flapClwBalance) return null;
    const bnb = flapBnbBalance.value;
    const clw = flapClwBalance as bigint;
    if (clw === 0n) return null;
    // price = bnb / clw, scaled to 18 decimals
    return (bnb * 10n ** 18n) / clw;
  }, [flapBnbBalance, flapClwBalance]);

  // BNB/USDT price from PancakeSwap V2 pair
  const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address;
  const BNB_USDT_PAIR = '0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE' as Address;
  const { data: pairReserves } = useReadContract({
    address: BNB_USDT_PAIR,
    abi: [{ name: 'getReserves', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: 'reserve0', type: 'uint112' }, { name: 'reserve1', type: 'uint112' }, { name: 'blockTimestampLast', type: 'uint32' }] }] as const,
    functionName: 'getReserves',
  });

  const priceDisplay = useMemo(() => {
    if (!price) return '--';
    const pBnb = Number(formatEther(price));

    // Calculate USDT price if BNB/USDT pair data available
    if (pairReserves) {
      const r0 = Number(formatEther(pairReserves[0] as bigint)); // WBNB (18 dec)
      const r1raw = pairReserves[1] as bigint;
      const r1 = Number(r1raw) / 1e18; // USDT (18 dec on BSC)
      const bnbUsd = r0 > 0 ? r1 / r0 : 0;
      const usdPrice = pBnb * bnbUsd;
      if (usdPrice < 0.0000000001) return '$0.0000000001';
      if (usdPrice < 0.01) return '$' + usdPrice.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
      return '$' + usdPrice.toFixed(4);
    }

    if (pBnb < 0.0000000001) return '0.0000000001 BNB';
    if (pBnb < 0.01) return pBnb.toFixed(10).replace(/0+$/, '').replace(/\.$/, '') + ' BNB';
    return pBnb.toFixed(4) + ' BNB';
  }, [price, pairReserves]);
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
    : `https://flap.sh/bnb/${CLW_TOKEN_ADDRESS}`;

  return (
    <div className="term-box" data-title={t('token.title')}>
      <div className="flex flex-col justify-between h-full">
        <div>
          {/* Price display */}
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tighter mb-1 glow-strong">
            {priceDisplay}
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
