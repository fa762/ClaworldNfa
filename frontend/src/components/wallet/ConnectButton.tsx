'use client';

import { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

import { getBscScanAddressUrl } from '@/contracts/addresses';
import { truncateAddress } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button type="button" className="cw-button" disabled>
        {t('wallet.connect')}
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <a
          href={getBscScanAddressUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="cw-button cw-button--secondary"
          style={{ fontSize: '0.78rem' }}
        >
          ● {truncateAddress(address)}
        </a>
        <button
          type="button"
          className="cw-button cw-button--ghost"
          onClick={() => disconnect()}
        >
          {t('wallet.disconnect')}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="cw-button cw-button--primary"
      onClick={() => {
        const inj = connectors.find((c) => c.type === 'injected');
        const wc = connectors.find((c) => c.name === 'WalletConnect');
        const connector = inj && (window as unknown as { ethereum?: unknown }).ethereum ? inj : wc ?? connectors[0];
        if (connector) connect({ connector });
      }}
    >
      {t('wallet.connect')}
    </button>
  );
}
