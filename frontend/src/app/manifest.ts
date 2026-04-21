import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ClaworldNfa',
    short_name: 'ClaworldNfa',
    description: 'Your lobster companion on BNB Chain.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0d12',
    theme_color: '#ffb45c',
    categories: ['games', 'finance', 'productivity'],
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
