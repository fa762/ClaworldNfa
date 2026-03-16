'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { truncateAddress } from '@/lib/format';
import { getBscScanAddressUrl } from '@/contracts/addresses';
import { Wallet, LogOut, ExternalLink } from 'lucide-react';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-abyss-orange/15 text-abyss-orange border border-abyss-orange/20 font-medium"
        disabled
      >
        <Wallet size={14} />
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
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface/60 border border-white/[0.06] text-sm font-mono text-tech-blue hover:border-tech-blue/30 transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot" />
          {truncateAddress(address)}
        </a>
        <button
          onClick={() => disconnect()}
          className="p-2 rounded-xl bg-surface/60 border border-white/[0.06] text-gray-500 hover:text-red-400 hover:border-red-400/20 transition-colors"
          title="断开连接"
        >
          <LogOut size={14} />
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
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-abyss-orange to-abyss-orange-light text-white font-semibold hover:opacity-90 transition-all active:scale-[0.97] shadow-lg shadow-abyss-orange/20"
        >
          <Wallet size={14} />
          {connector.name === 'Injected' ? '连接钱包' : connector.name}
        </button>
      ))}
    </div>
  );
}
