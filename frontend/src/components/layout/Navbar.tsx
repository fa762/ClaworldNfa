'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { appEnv, isDemoMode, isMainnet } from '@/lib/env';
import { useI18n } from '@/lib/i18n';

const navLinkKeys = [
  { href: '/', labelKey: 'nav.home', key: 'HOME' },
  { href: '/mint', labelKey: 'nav.mint', key: 'MINT' },
  { href: '/guide', labelKey: 'nav.guide', key: 'GUIDE' },
  { href: '/lore', labelKey: 'nav.lore', key: 'LORE' },
  { href: '/nfa', labelKey: 'nav.nfa', key: 'NFA' },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => setMobileOpen(false), [pathname]);

  const chainLabel = appEnv === 'mainnet' ? 'BSC-56' : appEnv === 'testnet' ? 'BSC-97' : 'LOCAL';

  return (
    <>
      {/* Environment banner */}
      {!isMainnet && (
        <div className={`text-center text-xs py-0.5 ${
          isDemoMode ? 'text-rarity-epic' : 'term-warn'
        }`}>
          {isDemoMode ? t('env.demo') : t('env.testnet')}
        </div>
      )}

      <nav className="border-b border-crt-dim">
        <div className="max-w-6xl mx-auto px-4">
          {/* Title bar */}
          <div className="flex items-center justify-between py-2 text-xs term-dim border-b border-crt-darkest">
            <span>{t('nav.title')}</span>
            <span className="term-bright">{chainLabel}</span>
          </div>

          {/* Nav links */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-1">
              {/* Desktop */}
              <div className="hidden sm:flex items-center gap-0.5">
                {navLinkKeys.map((link) => {
                  const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`text-sm px-3 py-1 transition-all ${
                        isActive
                          ? 'term-active'
                          : 'term-dim hover:text-crt-green'
                      }`}
                    >
                      {isActive && '> '}{t(link.labelKey)}
                    </Link>
                  );
                })}
              </div>

              {/* Mobile hamburger */}
              <button
                className="sm:hidden term-btn text-xs"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                [{mobileOpen ? t('nav.close') : t('nav.menu')}]
              </button>
            </div>

            <ConnectButton />
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-crt-darkest px-4 py-2 animate-fade-in">
            {navLinkKeys.map((link) => {
              const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block text-sm py-2 ${
                    isActive ? 'term-active' : 'term-dim hover:text-crt-green'
                  }`}
                >
                  {isActive ? '> ' : '  '}{t(link.labelKey)}
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </>
  );
}
