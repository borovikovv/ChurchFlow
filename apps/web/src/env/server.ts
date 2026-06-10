import { webEnvSchema } from '@churchflow/shared';

export const serverEnv = webEnvSchema.parse({
  NODE_ENV: process.env['NODE_ENV'],
  NEXT_PUBLIC_WEB_URL: process.env['NEXT_PUBLIC_WEB_URL'],
  NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'],
  API_INTERNAL_URL: process.env['API_INTERNAL_URL']
});
