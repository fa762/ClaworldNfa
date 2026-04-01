'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Global keyboard navigation for the terminal UI.
 *
 * - Enter: activate focused link/button, or click the current kbd-focused element
 *
 * Does NOT interfere with text selection or input fields.
 */
export function KeyboardNav() {
  const pathname = usePathname();

  useEffect(() => {
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

      switch (e.key) {
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
  }, [pathname]);

  // This component renders nothing — it's purely a keyboard event listener
  return null;
}
