import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactStrictMode: true,
  allowedDevOrigins: ['churchflow.test'],
  async rewrites() {
    const apiBaseUrl = process.env['API_INTERNAL_URL'] ?? 'http://localhost:4000/v1';

    return [
      {
        source: '/v1/:path*',
        destination: `${apiBaseUrl}/:path*`
      }
    ];
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'churchflow.test']
    }
  }
};

export default nextConfig;
