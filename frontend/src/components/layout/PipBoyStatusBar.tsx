'use client';

import { useAccount } from 'wagmi';
import { truncateAddress } from '@/lib/format';
import { appEnv } from '@/lib/env';
import { SocialLinks } from './SocialLinks';

export function PipBoyStatusBar() {
  const { address, isConnected } = useAccount();
  const chainLabel = appEnv === 'mainnet' ? 'BSC-56' : appEnv === 'testnet' ? 'BSC-97' : 'LOCAL';

  return (
    <div className="pipboy-statusbar">
      <div className="flex items-center gap-3 term-dim">
        <span>NET:<span className="text-crt-green ml-0.5">{chainLabel}</span></span>
        <span className="hidden sm:inline term-darkest">│</span>
        <span className="hidden sm:inline">
          {isConnected && address
            ? <span className="text-crt-green">{truncateAddress(address)}</span>
            : <span className="term-darkest">未连接</span>
          }
        </span>
        <span className="hidden sm:inline term-darkest">│</span>
        <span className="hidden sm:inline term-darkest">v2.0</span>
      </div>
      <SocialLinks />
    </div>
  );
}
