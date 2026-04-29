'use client';

import { useLayoutEffect } from 'react';

export function LandingScrollMode() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previous = {
      rootHeight: root.style.getPropertyValue('height'),
      rootMinHeight: root.style.getPropertyValue('min-height'),
      rootOverflowX: root.style.getPropertyValue('overflow-x'),
      rootOverflowY: root.style.getPropertyValue('overflow-y'),
      rootScrollbarWidth: root.style.getPropertyValue('scrollbar-width'),
      bodyHeight: body.style.getPropertyValue('height'),
      bodyMinHeight: body.style.getPropertyValue('min-height'),
      bodyOverflowX: body.style.getPropertyValue('overflow-x'),
      bodyOverflowY: body.style.getPropertyValue('overflow-y'),
      bodyPosition: body.style.getPropertyValue('position'),
      bodyScrollbarWidth: body.style.getPropertyValue('scrollbar-width'),
    };

    const enablePageScroll = () => {
      root.classList.add('cw-landing-scroll');
      body.classList.add('cw-landing-scroll');
      root.style.setProperty('height', 'auto', 'important');
      root.style.setProperty('min-height', '100%', 'important');
      root.style.setProperty('overflow-x', 'hidden', 'important');
      root.style.setProperty('overflow-y', 'auto', 'important');
      root.style.setProperty('scrollbar-width', 'none');
      body.style.setProperty('height', 'auto', 'important');
      body.style.setProperty('min-height', '100%', 'important');
      body.style.setProperty('overflow-x', 'hidden', 'important');
      body.style.setProperty('overflow-y', 'auto', 'important');
      body.style.setProperty('position', 'static');
      body.style.setProperty('scrollbar-width', 'none');
    };

    const forceWheelScroll = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        return;
      }

      const before = window.scrollY;
      window.scrollBy({ top: event.deltaY, left: 0, behavior: 'auto' });

      if (window.scrollY !== before) {
        event.preventDefault();
      }
    };

    enablePageScroll();
    window.addEventListener('wheel', forceWheelScroll, { capture: true, passive: false });

    return () => {
      window.removeEventListener('wheel', forceWheelScroll, { capture: true });
      root.classList.remove('cw-landing-scroll');
      body.classList.remove('cw-landing-scroll');
      root.style.setProperty('height', previous.rootHeight);
      root.style.setProperty('min-height', previous.rootMinHeight);
      root.style.setProperty('overflow-x', previous.rootOverflowX);
      root.style.setProperty('overflow-y', previous.rootOverflowY);
      root.style.setProperty('scrollbar-width', previous.rootScrollbarWidth);
      body.style.setProperty('height', previous.bodyHeight);
      body.style.setProperty('min-height', previous.bodyMinHeight);
      body.style.setProperty('overflow-x', previous.bodyOverflowX);
      body.style.setProperty('overflow-y', previous.bodyOverflowY);
      body.style.setProperty('position', previous.bodyPosition);
      body.style.setProperty('scrollbar-width', previous.bodyScrollbarWidth);
    };
  }, []);

  return null;
}
