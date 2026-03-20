'use client';

import { useAccount } from 'wagmi';
import { truncateAddress } from '@/lib/format';
import { appEnv } from '@/lib/env';
import { SocialLinks } from './SocialLinks';
import { useI18n } from '@/lib/i18n';

export function PipBoyStatusBar() {
  const { address, isConnected } = useAccount();
  const { t } = useI18n();
  const chainLabel = appEnv === 'mainnet' ? 'BSC-56' : appEnv === 'testnet' ? 'BSC-97' : 'LOCAL';

  return (
    <div className="pipboy-statusbar">
      <div className="flex items-center gap-3">
        <span>NET:<span className="text-crt-green ml-0.5">{chainLabel}</span></span>
        <span className="hidden sm:inline opacity-40">|</span>
        <span className="hidden sm:inline">
          {isConnected && address
            ? <span className="text-crt-green">{truncateAddress(address)}</span>
            : <span className="opacity-40">{t('status.notConnected')}</span>
          }
        </span>
      </div>
      <div className="flex items-center gap-3">
        <SocialLinks />
        <span className="w-1.5 h-3 bg-crt-green animate-pulse" />
      </div>
    </div>
  );
}
