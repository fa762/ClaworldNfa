'use client';

import { createConfig, http, WagmiProvider } from 'wagmi';
import { bsc, bscTestnet } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected, walletConnect } from 'wagmi/connectors';
import { type ReactNode } from 'react';
import { chainId, rpcUrl } from '@/contracts/addresses';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

const connectors = [
  injected(),
  ...(projectId ? [walletConnect({ projectId })] : []),
];

// Force legacy (type 0) transactions on BSC Testnet to avoid
// "Unknown transaction type" errors in MetaMask
const bscTestnetLegacy = {
  ...bscTestnet,
  fees: undefined,
} as const;

const config = chainId === 56
  ? createConfig({
      chains: [bsc],
      connectors,
      transports: { [bsc.id]: http(rpcUrl) },
      ssr: true,
    })
  : createConfig({
      chains: [bscTestnetLegacy],
      connectors,
      transports: { [bscTestnet.id]: http(rpcUrl) },
      ssr: true,
    });

export { config };

const queryClient = new QueryClient();

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
