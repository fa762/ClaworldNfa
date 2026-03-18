'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { appEnv, isDemoMode, isMainnet } from '@/lib/env';

const navLinks = [
  { href: '/', label: '首页', key: 'HOME' },
  { href: '/mint', label: '铸造', key: 'MINT' },
  { href: '/guide', label: '指南', key: 'GUIDE' },
  { href: '/lore', label: '世界观', key: 'LORE' },
  { href: '/nfa', label: 'NFA', key: 'NFA' },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  const chainLabel = appEnv === 'mainnet' ? 'BSC-56' : appEnv === 'testnet' ? 'BSC-97' : 'LOCAL';

  return (
    <>
      {/* Environment banner */}
      {!isMainnet && (
        <div className={`text-center text-xs py-0.5 ${
          isDemoMode ? 'text-rarity-epic' : 'term-warn'
        }`}>
          {isDemoMode ? '[ DEMO MODE — 模拟数据 ]' : '[ TESTNET — 测试网络 ]'}
        </div>
      )}

      <nav className="border-b border-crt-dim">
        <div className="max-w-6xl mx-auto px-4">
          {/* Title bar */}
          <div className="flex items-center justify-between py-2 text-xs term-dim border-b border-crt-darkest">
            <span>CLAW WORLD TERMINAL v2.0</span>
            <span className="term-bright">{chainLabel}</span>
          </div>

          {/* Nav links */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-1">
              {/* Desktop */}
              <div className="hidden sm:flex items-center gap-0.5">
                {navLinks.map((link) => {
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
                      {isActive && '> '}{link.label}
                    </Link>
                  );
                })}
              </div>

              {/* Mobile hamburger */}
              <button
                className="sm:hidden term-btn text-xs"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                [{mobileOpen ? 'CLOSE' : 'MENU'}]
              </button>
            </div>

            <ConnectButton />
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-crt-darkest px-4 py-2 animate-fade-in">
            {navLinks.map((link) => {
              const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block text-sm py-2 ${
                    isActive ? 'term-active' : 'term-dim hover:text-crt-green'
                  }`}
                >
                  {isActive ? '> ' : '  '}{link.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </>
  );
}
