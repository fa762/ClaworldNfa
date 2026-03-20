'use client';

import { useEffect } from 'react';

/**
 * Positions the CRT content viewport exactly over the transparent screen
 * cutout in terminal-bg.png.
 *
 * The transparent region was detected by scanning the PNG alpha channel:
 *   Image:  2773 × 1512
 *   Screen: x 670..2026, y 214..1281  (1357 × 1068 px)
 *
 * With object-fit: cover the browser scales the image to fill the viewport.
 * We replicate that math to convert image-space coordinates to viewport-space.
 */

const IMG_W = 2773;
const IMG_H = 1512;
const IMG_ASPECT = IMG_W / IMG_H;

// Exact transparent-region bounds (from PNG alpha scan)
const SCREEN_LEFT   = 670  / IMG_W;  // 0.241616
const SCREEN_TOP    = 214  / IMG_H;  // 0.141534
const SCREEN_WIDTH  = 1357 / IMG_W;  // 0.489362
const SCREEN_HEIGHT = 1068 / IMG_H;  // 0.706349

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
