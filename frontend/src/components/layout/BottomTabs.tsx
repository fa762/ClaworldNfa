'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, House, Pickaxe, Settings2, Swords } from 'lucide-react';

const tabs = [
  { href: '/', label: 'Home', icon: House },
  { href: '/play', label: 'Play', icon: Pickaxe },
  { href: '/arena', label: 'Arena', icon: Swords },
  { href: '/auto', label: 'Auto', icon: Bot },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

function isActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav className="cw-tabs" aria-label="Primary navigation">
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
