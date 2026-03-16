'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { isTestnet } from '@/contracts/addresses';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { href: '/', label: '首页' },
  { href: '/guide', label: '游戏指南' },
  { href: '/lore', label: '世界观' },
  { href: '/nfa', label: 'NFA 合集' },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {isTestnet && (
        <div className="bg-yellow-600/90 text-center text-sm py-1 font-medium text-black">
          BSC Testnet — 测试网络环境
        </div>
      )}
      <nav className="sticky top-0 z-50 bg-navy/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-heading font-bold text-abyss-orange">
              CLAW WORLD
            </Link>
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm transition-colors ${
                    pathname === link.href
                      ? 'text-abyss-orange font-medium'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <ConnectButton />
            </div>
            <button
              className="md:hidden text-gray-400 hover:text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 bg-navy/95 backdrop-blur">
            <div className="px-4 py-4 space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block text-sm py-2 transition-colors ${
                    pathname === link.href
                      ? 'text-abyss-orange font-medium'
                      : 'text-gray-400'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 border-t border-white/10">
                <ConnectButton />
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
