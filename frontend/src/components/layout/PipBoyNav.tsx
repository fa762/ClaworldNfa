'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { isDemoMode, isMainnet } from '@/lib/env';

const tabs = [
  { href: '/', label: '首页', key: 'HOME' },
  { href: '/mint', label: '铸造', key: 'MINT' },
  { href: '/nfa', label: 'NFA', key: 'NFA' },
  { href: '/guide', label: '指南', key: 'GUIDE' },
  { href: '/lore', label: '世界观', key: 'LORE' },
];

export function PipBoyNav() {
  const pathname = usePathname();

  return (
    <div>
      {/* Env banner */}
      {!isMainnet && (
        <div className={`text-center text-[10px] py-0.5 ${isDemoMode ? 'text-rarity-epic' : 'term-warn'}`}>
          {isDemoMode ? '[ DEMO MODE ]' : '[ TESTNET ]'}
        </div>
      )}

      <div className="pipboy-nav">
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
