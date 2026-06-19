import { z } from 'zod';

export const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

const optionalNonEmptyString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

const optionalEmailProviderSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.enum(['resend', 'console']).optional(),
);

const pemKeySchema = (label: string, keyType: 'PUBLIC' | 'PRIVATE') =>
  z
    .string()
    .min(1)
    .refine((value) => value.replace(/\\n/g, '\n').includes(`-----BEGIN ${keyType} KEY-----`), {
      message: `${label} must be a PEM ${keyType.toLowerCase()} key`,
    });

export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_PUBLIC_KEY: pemKeySchema('JWT_ACCESS_PUBLIC_KEY', 'PUBLIC'),
  JWT_ACCESS_PRIVATE_KEY: pemKeySchema('JWT_ACCESS_PRIVATE_KEY', 'PRIVATE'),
  JWT_REFRESH_PUBLIC_KEY: pemKeySchema('JWT_REFRESH_PUBLIC_KEY', 'PUBLIC'),
  JWT_REFRESH_PRIVATE_KEY: pemKeySchema('JWT_REFRESH_PRIVATE_KEY', 'PRIVATE'),
  COOKIE_DOMAIN: z.string().optional(),
  WEB_APP_URL: z.string().url(),
  PLATFORM_ADMIN_EMAIL: z.string().email(),
  TELEGRAM_CLIENT_ID: optionalNonEmptyString,
  TELEGRAM_CLIENT_SECRET: optionalNonEmptyString,
  TELEGRAM_REDIRECT_URI: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  EMAIL_PROVIDER: optionalEmailProviderSchema,
  EMAIL_FROM: optionalNonEmptyString,
  RESEND_API_KEY: optionalNonEmptyString,
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
});

export const webEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    NEXT_PUBLIC_WEB_URL: z.string().url().optional(),
    API_INTERNAL_URL: z.string().url().optional(),
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'production') {
      return;
    }

    for (const key of ['NEXT_PUBLIC_WEB_URL', 'API_INTERNAL_URL', 'NEXT_PUBLIC_API_URL'] as const) {
      if (!env[key]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required in production`,
        });
      }
    }
  })
  .transform((env) => ({
    NODE_ENV: env.NODE_ENV,
    NEXT_PUBLIC_WEB_URL: env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
    API_INTERNAL_URL: env.API_INTERNAL_URL ?? 'http://localhost:4000/v1',
    NEXT_PUBLIC_API_URL: env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1',
  }));

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
