import { formatEther } from 'viem';
import { isTestnet } from './env';

export const nativeSymbol = isTestnet ? 'tBNB' : 'BNB';

export function formatBNB(wei: bigint, decimals = 4): string {
  const val = Number(formatEther(wei));
  return val.toFixed(decimals);
}

function formatCompactClaworld(value: number, divisor: number, suffix: 'k' | 'M') {
  const compact = value / divisor;
  const precision = compact >= 100 ? 0 : 1;
  return `${compact.toFixed(precision).replace(/\.0$/, '')}${suffix}`;
}

export function formatCLW(wei: bigint, decimals = 2): string {
  const val = Number(formatEther(wei));
  if (val >= 1_000_000) return formatCompactClaworld(val, 1_000_000, 'M');
  if (val >= 999_500) return '1M';
  if (val >= 1_000) return formatCompactClaworld(val, 1_000, 'k');
  return val.toFixed(decimals);
}

export function truncateAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatBasisPoints(bp: bigint | number): string {
  const val = Number(bp) / 10000;
  return `${val.toFixed(2)}x`;
}

/**
 * Smart compact number display for card/grid views.
 * 0.00001 → "<0.01"
 * 0.123   → "0.12"
 * 5.5     → "5.5"
 * 999     → "999"
 * 1,234   → "1.2K"
 * 56,789  → "56.8K"
 * 1234567 → "1.2M"
 */
export function formatCompact(val: number): string {
  if (val <= 0) return '0';
  if (val < 0.01) return '<0.01';
  if (val < 1) return val.toFixed(2);
  if (val < 10) return val.toFixed(1);
  if (val < 1000) return Math.floor(val).toString();
  if (val < 1_000_000) return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
}
