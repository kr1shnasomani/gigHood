import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Transpile deck.gl and maplibre ESM packages so Turbopack can bundle them
  transpilePackages: [
    'deck.gl',
    '@deck.gl/core',
    '@deck.gl/layers',
    '@deck.gl/geo-layers',
    '@deck.gl/react',
    '@deck.gl/aggregation-layers',
    '@deck.gl/extensions',
    '@deck.gl/mesh-layers',
    '@luma.gl/core',
    '@luma.gl/webgl',
    'maplibre-gl',
  ],

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@tanstack/react-query',
      'framer-motion',
      'react-markdown',
    ],
  },

  async redirects() {
    return [
      { source: '/worker-app', destination: '/worker-app/home', permanent: false },
      { source: '/login', destination: '/worker-app/login', permanent: false },
      { source: '/register', destination: '/worker-app/register', permanent: false },
      { source: '/home', destination: '/worker-app/home', permanent: false },
      { source: '/chat', destination: '/worker-app/chat', permanent: false },
      { source: '/payouts', destination: '/worker-app/payouts', permanent: false },
      { source: '/profile', destination: '/worker-app/profile', permanent: false },
      { source: '/govt', destination: '/worker-app/govt', permanent: false },
      { source: '/radar', destination: '/worker-app/radar', permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: '/worker-app/login', destination: '/login' },
      { source: '/worker-app/register', destination: '/register' },
      { source: '/worker-app/home', destination: '/home' },
      { source: '/worker-app/chat', destination: '/chat' },
      { source: '/worker-app/payouts', destination: '/payouts' },
      { source: '/worker-app/profile', destination: '/profile' },
      { source: '/worker-app/govt', destination: '/govt' },
      { source: '/worker-app/radar', destination: '/radar' },
    ];
  },
};

export default nextConfig;
