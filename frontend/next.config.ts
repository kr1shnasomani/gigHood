import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
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
