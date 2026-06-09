import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000']
    }
  }
};

export default nextConfig;
