import path from 'node:path';

import type { NextConfig } from 'next';

const workspaceRoot = path.resolve(__dirname, '..');

const nextConfig: NextConfig = {
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
  async redirects() {
    return [
      {
        source: '/play',
        destination: '/?action=mining',
        permanent: false,
      },
      {
        source: '/play/:path*',
        destination: '/?action=mining',
        permanent: false,
      },
      {
        source: '/arena',
        destination: '/?action=arena',
        permanent: false,
      },
      {
        source: '/arena/:path*',
        destination: '/?action=arena',
        permanent: false,
      },
      {
        source: '/auto',
        destination: '/?action=auto',
        permanent: false,
      },
      {
        source: '/auto/:path*',
        destination: '/?action=auto',
        permanent: false,
      },
      {
        source: '/mint',
        destination: '/?action=mint',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
