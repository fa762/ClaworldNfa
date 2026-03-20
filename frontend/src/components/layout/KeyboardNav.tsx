'use client';

import { useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const NAV_TABS = [
  { href: '/', label: 'WORLD' },
  { href: '/mint', label: 'MINT' },
  { href: '/nfa', label: 'VAULT' },
  { href: '/guide', label: 'DATA' },
  { href: '/lore', label: 'LORE' },
];

const SCROLL_STEP = 120;

/**
 * Global keyboard navigation for the terminal UI.
 *
 * - ArrowUp / ArrowDown: scroll main content area
 * - ArrowLeft / ArrowRight: switch between nav tabs
 * - Enter: activate focused link/button, or click the current kbd-focused element
 *
 * Does NOT interfere with text selection or input fields.
 */
export function KeyboardNav() {
  const router = useRouter();
  const pathname = usePathname();

  const getCurrentTabIndex = useCallback(() => {
    const idx = NAV_TABS.findIndex(
      (t) => t.href === '/' ? pathname === '/' : pathname.startsWith(t.href)
    );
    return idx >= 0 ? idx : 0;
  }, [pathname]);

  useEffect(() => {
    function getMainEl(): HTMLElement | null {
      return document.querySelector('.crt-content > main');
    }

    function isInputFocused(): boolean {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (el as HTMLElement).isContentEditable
      );
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Don't hijack when user is typing in an input
      if (isInputFocused()) return;

      const main = getMainEl();

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault();
          if (main) main.scrollTop -= SCROLL_STEP;
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (main) main.scrollTop += SCROLL_STEP;
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const idx = getCurrentTabIndex();
          const prev = idx > 0 ? idx - 1 : NAV_TABS.length - 1;
          router.push(NAV_TABS[prev].href);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const idx = getCurrentTabIndex();
          const next = idx < NAV_TABS.length - 1 ? idx + 1 : 0;
          router.push(NAV_TABS[next].href);
          break;
        }
        case 'Enter': {
          // If a focusable element has focus (link/button), let default behavior handle it.
          // Otherwise, try to find and click a kbd-focused element.
          const focused = document.querySelector('.kbd-focused') as HTMLElement | null;
          if (focused) {
            e.preventDefault();
            focused.click();
          }
          break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [getCurrentTabIndex, router]);

  // This component renders nothing — it's purely a keyboard event listener
  return null;
}
