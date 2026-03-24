import { formatEther } from 'viem';
import { isTestnet } from './env';

export const nativeSymbol = isTestnet ? 'tBNB' : 'BNB';

export function formatBNB(wei: bigint, decimals = 4): string {
  const val = Number(formatEther(wei));
  return val.toFixed(decimals);
}

export function formatCLW(wei: bigint, decimals = 2): string {
  const val = Number(formatEther(wei));
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
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
