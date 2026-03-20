'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { truncateAddress } from '@/lib/format';
import { getBscScanAddressUrl } from '@/contracts/addresses';
import { useI18n } from '@/lib/i18n';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span className="term-dim text-xs">[{t('wallet.connect')}]</span>;
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
          [{t('wallet.disconnect')}]
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        // Prefer injected (MetaMask etc.) if available, fallback to WalletConnect
        const inj = connectors.find((c) => c.type === 'injected');
        const wc = connectors.find((c) => c.name === 'WalletConnect');
        const connector = (inj && (window as any).ethereum) ? inj : wc || connectors[0];
        if (connector) connect({ connector });
      }}
      className="term-btn term-btn-primary text-xs"
    >
      [{t('wallet.connect')}]
    </button>
  );
}
