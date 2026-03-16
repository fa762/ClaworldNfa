'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { truncateAddress } from '@/lib/format';
import { getBscScanAddressUrl } from '@/contracts/addresses';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Prevent hydration mismatch: render placeholder on server
  if (!mounted) {
    return (
      <button
        className="px-4 py-1.5 text-sm rounded-lg bg-abyss-orange text-white font-medium hover:bg-abyss-orange/80 transition-colors"
        disabled
      >
        连接钱包
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <a
          href={getBscScanAddressUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-mono text-tech-blue hover:underline"
        >
          {truncateAddress(address)}
        </a>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1.5 text-sm rounded-lg bg-card-dark border border-gray-700 hover:border-abyss-orange transition-colors"
        >
          断开
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          className="px-4 py-1.5 text-sm rounded-lg bg-abyss-orange text-white font-medium hover:bg-abyss-orange/80 transition-colors"
        >
          {connector.name === 'Injected' ? '连接钱包' : connector.name}
        </button>
      ))}
    </div>
  );
}
