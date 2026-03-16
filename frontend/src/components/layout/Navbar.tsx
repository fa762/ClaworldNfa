'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { appEnv, envLabel, isDemoMode, isMainnet } from '@/lib/env';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { href: '/', label: '首页' },
  { href: '/guide', label: '游戏指南' },
  { href: '/lore', label: '世界观' },
  { href: '/nfa', label: 'NFA 合集' },
];

const envBannerConfig: Record<string, { bg: string; text: string }> = {
  local: { bg: 'bg-purple-600/90', text: '本地演示模式 — 显示模拟数据' },
  testnet: { bg: 'bg-yellow-600/90', text: 'BSC Testnet — 测试网络环境' },
};

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const banner = envBannerConfig[appEnv];

  return (
    <>
      {banner && (
        <div className={`${banner.bg} text-center text-xs py-1 font-medium text-black`}>
          {banner.text}
        </div>
      )}
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-navy/98 backdrop-blur-lg shadow-lg shadow-black/20 border-b border-white/5'
          : 'bg-navy/95 backdrop-blur border-b border-white/10'
      }`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 text-xl font-heading font-bold text-abyss-orange hover:text-abyss-orange/90 transition-colors">
              <span className="text-gradient-orange">CLAW WORLD</span>
              {!isMainnet && (
                <span className={`text-[10px] font-sans font-normal px-1.5 py-0.5 rounded border ${
                  isDemoMode
                    ? 'bg-purple-900/50 text-purple-300 border-purple-500/30'
                    : 'bg-yellow-900/50 text-yellow-300 border-yellow-500/30'
                }`}>
                  {envLabel[appEnv]}
                </span>
              )}
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative text-sm px-3 py-1.5 rounded-lg transition-all ${
                    pathname === link.href
                      ? 'text-abyss-orange font-medium bg-abyss-orange/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
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
              className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
          mobileOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="border-t border-white/10 bg-navy/98 backdrop-blur-lg">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block text-sm py-2.5 px-3 rounded-lg transition-colors ${
                    pathname === link.href
                      ? 'text-abyss-orange font-medium bg-abyss-orange/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 border-t border-white/10">
                <ConnectButton />
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
