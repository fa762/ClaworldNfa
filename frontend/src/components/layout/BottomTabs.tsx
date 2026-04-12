'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, House, Pickaxe, Settings2, Swords } from 'lucide-react';

import { useI18n } from '@/lib/i18n';

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomTabs() {
  const pathname = usePathname();
  const { t } = useI18n();

  const tabs = [
    { href: '/', label: t('nav.home'), icon: House },
    { href: '/play', label: t('shell.play'), icon: Pickaxe },
    { href: '/arena', label: t('shell.arena'), icon: Swords },
    { href: '/auto', label: t('shell.auto'), icon: Bot },
    { href: '/settings', label: t('shell.settings'), icon: Settings2 },
  ];

  return (
    <nav className="cw-tabs" aria-label={t('shell.primaryNav')}>
      {tabs.map(({ href, icon: Icon, label }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`cw-tab ${active ? 'cw-tab--active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={18} strokeWidth={2} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
