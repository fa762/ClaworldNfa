import { createPublicClient, http } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';

import { addresses, chainId, rpcUrl } from '@/contracts/addresses';

const chain = chainId === 56 ? bsc : bscTestnet;

export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

export function ensureConfigured(addressKeys: (keyof typeof addresses)[]) {
  for (const key of addressKeys) {
    if (!addresses[key]) {
      throw new Error(`Contract address is not configured: ${String(key)}`);
    }
  }
}
