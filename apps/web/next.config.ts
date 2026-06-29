import type { NextConfig } from 'next';
import { webEnvSchema } from '@churchflow/shared';

const env = webEnvSchema.parse({
  NODE_ENV: process.env['NODE_ENV'],
  NEXT_PUBLIC_WEB_URL: process.env['NEXT_PUBLIC_WEB_URL'],
  NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'],
  API_INTERNAL_URL: process.env['API_INTERNAL_URL'],
});
const webHost = new URL(env.NEXT_PUBLIC_WEB_URL).host;

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactStrictMode: true,
  allowedDevOrigins: [webHost],
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: `${env.API_INTERNAL_URL}/:path*`,
      },
    ];
  },
  experimental: {
    serverActions: {
      allowedOrigins: [webHost],
    },
  },
};

export default nextConfig;
