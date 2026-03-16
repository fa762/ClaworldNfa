'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { appEnv, envLabel, isDemoMode, isMainnet } from '@/lib/env';
import { Menu, X, Shell } from 'lucide-react';

const navLinks = [
  { href: '/', label: '首页' },
  { href: '/guide', label: '游戏指南' },
  { href: '/lore', label: '世界观' },
  { href: '/nfa', label: 'NFA 合集' },
];

const envBannerConfig: Record<string, { bg: string; text: string }> = {
  local: { bg: 'bg-gradient-to-r from-purple-600/90 via-purple-500/90 to-purple-600/90', text: '本地演示模式 — 显示模拟数据' },
  testnet: { bg: 'bg-gradient-to-r from-yellow-600/90 via-yellow-500/90 to-yellow-600/90', text: 'BSC Testnet — 测试网络环境' },
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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const banner = envBannerConfig[appEnv];

  return (
    <>
      {banner && (
        <div className={`${banner.bg} text-center text-xs py-1 font-medium text-black/80`}>
          {banner.text}
        </div>
      )}
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-navy/[0.97] backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.3)] border-b border-white/5'
          : 'bg-navy/90 backdrop-blur-md border-b border-white/10'
      }`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-abyss-orange to-abyss-orange-light flex items-center justify-center shadow-lg shadow-abyss-orange/20 group-hover:shadow-abyss-orange/40 transition-shadow">
                <Shell size={16} className="text-white" />
              </div>
              <span className="text-lg font-heading font-bold text-gradient-orange hidden sm:block">
                CLAW WORLD
              </span>
              {!isMainnet && (
                <span className={`text-[10px] font-sans font-normal px-1.5 py-0.5 rounded-md ${
                  isDemoMode
                    ? 'bg-purple-900/50 text-purple-300 border border-purple-500/30'
                    : 'bg-yellow-900/50 text-yellow-300 border border-yellow-500/30'
                }`}>
                  {envLabel[appEnv]}
                </span>
              )}
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative text-sm px-3.5 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'text-abyss-orange font-medium bg-abyss-orange/10'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-abyss-orange" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <ConnectButton />
            </div>
            <button
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
          mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="border-t border-white/5 bg-navy/[0.98] backdrop-blur-xl">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => {
                const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 text-sm py-3 px-4 rounded-lg transition-colors ${
                      isActive
                        ? 'text-abyss-orange font-medium bg-abyss-orange/10'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {isActive && <span className="w-1 h-4 rounded-full bg-abyss-orange" />}
                    {link.label}
                  </Link>
                );
              })}
              <div className="pt-3 mt-2 border-t border-white/5">
                <ConnectButton />
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
