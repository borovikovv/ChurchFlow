import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv, webEnvSchema } from '@churchflow/shared';

const env = parseEnv('Web build', webEnvSchema, {
  NODE_ENV: process.env['NODE_ENV'],
  NEXT_PUBLIC_WEB_URL: process.env['NEXT_PUBLIC_WEB_URL'],
  NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'],
  API_INTERNAL_URL: process.env['API_INTERNAL_URL'],
  JWT_ACCESS_PUBLIC_KEY: process.env['JWT_ACCESS_PUBLIC_KEY'],
});
const webHost = new URL(env.NEXT_PUBLIC_WEB_URL).host;
const sharedSource = fileURLToPath(new URL('./src/shared/index.ts', import.meta.url));
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  typedRoutes: true,
  reactStrictMode: true,
  webpack(config) {
    config.resolve.alias['@churchflow/shared$'] = sharedSource;
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    return config;
  },
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

export default withNextIntl(nextConfig);
