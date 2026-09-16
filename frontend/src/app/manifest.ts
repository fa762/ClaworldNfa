import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'claworldnfa',
    short_name: 'claworldnfa',
    description: 'Persistent AI agent runtime with identity, memory, bounded execution, and auditable receipts.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#10231c',
    theme_color: '#0b6b4f',
    categories: ['developer', 'productivity', 'utilities'],
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
