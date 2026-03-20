'use client';

import { useEffect } from 'react';

/**
 * Computes the CRT viewport position over the terminal background image.
 *
 * With object-fit: cover the browser scales the image to fill the viewport
 * entirely, cropping the overflow. We replicate that math in JS and set
 * inline styles on .crt-viewport so the content area aligns with the
 * screen cutout in the image — regardless of viewport aspect ratio.
 */

const IMG_W = 2773;
const IMG_H = 1512;
const IMG_ASPECT = IMG_W / IMG_H;

// Screen cutout percentages within the source image (measured from terminal-bg.png)
const SCREEN_LEFT   = 0.177;
const SCREEN_TOP    = 0.087;
const SCREEN_WIDTH  = 0.438;
const SCREEN_HEIGHT = 0.820;

function update() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Skip on mobile (image hidden, CSS handles fullscreen)
  if (vw <= 768) return;

  const vpAspect = vw / vh;

  let rw: number, rh: number, ox: number, oy: number;

  if (vpAspect > IMG_ASPECT) {
    // Viewport wider than image → scale by width, crop top/bottom
    rw = vw;
    rh = vw / IMG_ASPECT;
    ox = 0;
    oy = (vh - rh) / 2;
  } else {
    // Viewport taller than image → scale by height, crop left/right
    rh = vh;
    rw = vh * IMG_ASPECT;
    ox = (vw - rw) / 2;
    oy = 0;
  }

  const el = document.querySelector('.crt-viewport') as HTMLElement | null;
  if (!el) return;

  el.style.left   = `${ox + rw * SCREEN_LEFT}px`;
  el.style.top    = `${oy + rh * SCREEN_TOP}px`;
  el.style.width  = `${rw * SCREEN_WIDTH}px`;
  el.style.height = `${rh * SCREEN_HEIGHT}px`;
}

export function CRTPositioner() {
  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return null;
}
