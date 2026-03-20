'use client';

import { SocialLinks } from './SocialLinks';
import { appEnv } from '@/lib/env';
import { useAccount } from 'wagmi';
import { truncateAddress } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

export function Footer() {
  const { address, isConnected } = useAccount();
  const { t } = useI18n();
  const chainLabel = appEnv === 'mainnet' ? 'BSC-56' : appEnv === 'testnet' ? 'BSC-97' : 'LOCAL';

  return (
    <footer className="border-t border-crt-dim">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4 term-dim">
          <span>NET:<span className="text-crt-green">{chainLabel}</span></span>
          <span className="hidden sm:inline">│</span>
          <span className="hidden sm:inline">
            {t('footer.wallet')}:{isConnected && address
              ? <span className="text-crt-green">{truncateAddress(address)}</span>
              : <span className="term-darkest">{t('status.notConnected')}</span>
            }
          </span>
          <span className="hidden sm:inline">│</span>
          <span className="hidden sm:inline">v2.0</span>
        </div>
        <SocialLinks />
      </div>
    </footer>
  );
}
