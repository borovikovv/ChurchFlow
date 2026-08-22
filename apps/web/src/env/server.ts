import { parseEnv, webEnvSchema } from '../../../../packages/shared/src/env';

export const serverEnv = parseEnv('Web runtime', webEnvSchema, {
  NODE_ENV: process.env['NODE_ENV'],
  NEXT_PUBLIC_WEB_URL: process.env['NEXT_PUBLIC_WEB_URL'],
  NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'],
  API_INTERNAL_URL: process.env['API_INTERNAL_URL'],
  COOKIE_DOMAIN: process.env['COOKIE_DOMAIN'],
});
