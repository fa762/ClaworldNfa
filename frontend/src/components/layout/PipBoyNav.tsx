'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { isDemoMode, isMainnet } from '@/lib/env';
import { useI18n } from '@/lib/i18n';

const tabs = [
  { href: '/', labelKey: 'nav.world' as const, key: 'HOME' },
  { href: '/mint', labelKey: 'nav.mint' as const, key: 'MINT' },
  { href: '/nfa', labelKey: 'nav.vault' as const, key: 'NFA' },
  { href: '/guide', labelKey: 'nav.data' as const, key: 'GUIDE' },
  { href: '/lore', labelKey: 'nav.lore' as const, key: 'LORE' },
];

export function PipBoyNav() {
  const pathname = usePathname();
  const { lang, setLang, t } = useI18n();

  return (
    <div>
      {/* Env banner */}
      {!isMainnet && (
        <div className={`text-center text-[10px] py-0.5 font-bold ${isDemoMode ? 'text-rarity-epic' : 'term-warn'}`}>
          {isDemoMode ? '[ DEMO MODE — LOCAL ]' : '[ BSC TESTNET ]'}
        </div>
      )}

      <div className="pipboy-nav">
        <div className="text-sm font-extrabold tracking-tight uppercase opacity-80">
          {t('nav.title')}
        </div>
        <div className="pipboy-nav-tabs">
          {tabs.map((tab) => {
            const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`pipboy-tab ${isActive ? 'pipboy-tab-active' : ''}`}
              >
                {t(tab.labelKey)}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <ConnectButton />
          <button
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="term-btn text-[10px] px-2 py-0.5"
            title={lang === 'zh' ? 'Switch to English' : '切换到中文'}
          >
            {lang === 'zh' ? 'EN' : '中'}
          </button>
        </div>
      </div>
    </div>
  );
}
