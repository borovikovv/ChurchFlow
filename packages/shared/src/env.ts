import { createPrivateKey, createPublicKey } from 'node:crypto';
import { z } from 'zod';
import { normalizePem } from './pem.js';

export const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

const optionalNonEmptyString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

const optionalEmailProviderSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.enum(['resend', 'console', 'smtp']).optional(),
);

const pemKeySchema = (label: string, keyType: 'PUBLIC' | 'PRIVATE') =>
  z
    .string()
    .min(1)
    .transform(normalizePem)
    .refine((value) => value.includes(`-----BEGIN ${keyType} KEY-----`), {
      message: `${label} must be a PEM ${keyType.toLowerCase()} key`,
    })
    .refine((value) => canImportPemKey(value, keyType), {
      message: `${label} must be an importable PEM ${keyType.toLowerCase()} key`,
    });

export const apiEnvSchema = z
  .object({
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
    TELEGRAM_BOT_TOKEN: optionalNonEmptyString,
    TELEGRAM_BOT_USERNAME: optionalNonEmptyString,
    TELEGRAM_WEBHOOK_SECRET: optionalNonEmptyString,
    TELEGRAM_WEBHOOK_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().url().optional(),
    ),
    EMAIL_PROVIDER: optionalEmailProviderSchema,
    EMAIL_FROM: optionalNonEmptyString,
    RESEND_API_KEY: optionalNonEmptyString,
    SMTP_HOST: optionalNonEmptyString,
    SMTP_PORT: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.coerce.number().int().positive().optional(),
    ),
    S3_ENDPOINT: z.string().url(),
    S3_REGION: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'production') {
      for (const key of [
        'TELEGRAM_CLIENT_ID',
        'TELEGRAM_CLIENT_SECRET',
        'TELEGRAM_REDIRECT_URI',
      ] as const) {
        if (!env[key]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required in production`,
          });
        }
      }
    }

    if (env.EMAIL_PROVIDER === 'resend') {
      for (const key of ['EMAIL_FROM', 'RESEND_API_KEY'] as const) {
        if (!env[key]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when EMAIL_PROVIDER=resend`,
          });
        }
      }
    }

    if (env.EMAIL_PROVIDER === 'smtp') {
      for (const key of ['EMAIL_FROM', 'SMTP_HOST', 'SMTP_PORT'] as const) {
        if (!env[key]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when EMAIL_PROVIDER=smtp`,
          });
        }
      }
    }
  });

export const webEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    NEXT_PUBLIC_WEB_URL: z.string().url().optional(),
    API_INTERNAL_URL: z.string().url().optional(),
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
    JWT_ACCESS_PUBLIC_KEY: pemKeySchema('JWT_ACCESS_PUBLIC_KEY', 'PUBLIC').optional(),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'production') {
      return;
    }

    for (const key of [
      'NEXT_PUBLIC_WEB_URL',
      'API_INTERNAL_URL',
      'NEXT_PUBLIC_API_URL',
      'JWT_ACCESS_PUBLIC_KEY',
    ] as const) {
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
    JWT_ACCESS_PUBLIC_KEY: env.JWT_ACCESS_PUBLIC_KEY,
  }));

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;

export function formatEnvValidationError(label: string, error: unknown): string {
  if (!(error instanceof z.ZodError)) {
    return `${label} environment validation failed`;
  }

  const details = error.issues
    .map((issue) => {
      const path = issue.path.join('.') || 'environment';
      return `- ${path}: ${issue.message}`;
    })
    .join('\n');

  return `${label} environment validation failed:\n${details}`;
}

export function parseEnv<Output, Def extends z.ZodTypeDef, Input>(
  label: string,
  schema: z.ZodType<Output, Def, Input>,
  env: unknown,
): Output {
  try {
    return schema.parse(env);
  } catch (error) {
    throw new Error(formatEnvValidationError(label, error));
  }
}

function canImportPemKey(value: string, keyType: 'PUBLIC' | 'PRIVATE'): boolean {
  try {
    if (keyType === 'PUBLIC') {
      createPublicKey(value);
    } else {
      createPrivateKey(value);
    }
    return true;
  } catch {
    return false;
  }
}
