'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { isDemoMode, isMainnet } from '@/lib/env';

const tabs = [
  { href: '/', label: 'WORLD', key: 'HOME' },
  { href: '/mint', label: 'MINT', key: 'MINT' },
  { href: '/nfa', label: 'VAULT', key: 'NFA' },
  { href: '/guide', label: 'DATA', key: 'GUIDE' },
  { href: '/lore', label: 'LORE', key: 'LORE' },
];

export function PipBoyNav() {
  const pathname = usePathname();

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
          CLAW WORLD v2.0
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
                {tab.label}
              </Link>
            );
          })}
        </div>
        <ConnectButton />
      </div>
    </div>
  );
}
