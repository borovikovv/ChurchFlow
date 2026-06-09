import { z } from 'zod';

export const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_PUBLIC_KEY: z.string().min(1),
  JWT_ACCESS_PRIVATE_KEY: z.string().min(1),
  JWT_REFRESH_PUBLIC_KEY: z.string().min(1),
  JWT_REFRESH_PRIVATE_KEY: z.string().min(1),
  COOKIE_DOMAIN: z.string().optional(),
  WEB_APP_URL: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1)
});

export const webEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  NEXT_PUBLIC_WEB_URL: z.string().url(),
  API_INTERNAL_URL: z.string().url(),
  NEXT_PUBLIC_API_URL: z.string().url()
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
