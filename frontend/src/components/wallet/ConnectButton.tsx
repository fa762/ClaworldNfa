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
    <div className="flex gap-1">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          className="term-btn term-btn-primary text-xs"
        >
          [{connector.name === 'Injected' ? '连接钱包' : connector.name}]
        </button>
      ))}
    </div>
  );
}
