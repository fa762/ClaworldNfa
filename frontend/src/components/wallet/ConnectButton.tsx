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

  if (!mounted) {
    return <span className="term-dim text-xs">[连接钱包]</span>;
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <a
          href={getBscScanAddressUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="term-link"
        >
          <span className="term-dim">●</span> {truncateAddress(address)}
        </a>
        <button onClick={() => disconnect()} className="term-dim hover:term-danger transition-colors">
          [断开]
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        // Prefer WalletConnect, fall back to first available connector
        const wc = connectors.find((c) => c.name === 'WalletConnect');
        const connector = wc || connectors[0];
        if (connector) connect({ connector });
      }}
      className="term-btn term-btn-primary text-xs"
    >
      [连接钱包]
    </button>
  );
}
