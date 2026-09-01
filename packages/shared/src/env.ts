import { z } from 'zod';

export const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

const optionalNonEmptyString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

const optionalTrimmedNonEmptyString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().min(1).optional());

const optionalEmailProviderSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.enum(['resend', 'console', 'smtp']).optional(),
);

const optionalPositiveInt = (defaultValue: number) =>
  z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().positive().default(defaultValue),
  );

const optionalBooleanFlag = (defaultValue: boolean) =>
  z
    .preprocess(
      (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
      z.enum(['true', 'false', '1', '0', '']).optional(),
    )
    .transform((value) =>
      value === undefined || value === '' ? defaultValue : value === 'true' || value === '1',
    );

export const apiEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().url(),
    COOKIE_DOMAIN: optionalTrimmedNonEmptyString,
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
    WEBAUTHN_RP_ID: optionalTrimmedNonEmptyString,
    WEBAUTHN_RP_NAME: optionalTrimmedNonEmptyString,
    WEBAUTHN_ORIGINS: optionalTrimmedNonEmptyString,
    EMAIL_PROVIDER: optionalEmailProviderSchema,
    EMAIL_FROM: optionalNonEmptyString,
    RESEND_API_KEY: optionalNonEmptyString,
    SMTP_HOST: optionalNonEmptyString,
    SMTP_PORT: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.coerce.number().int().positive().optional(),
    ),
    NOTIFICATIONS_RETENTION_DAYS: optionalPositiveInt(365),
    NOTIFICATIONS_READ_RETENTION_DAYS: optionalPositiveInt(180),
    NOTIFICATIONS_RETENTION_DRY_RUN: optionalBooleanFlag(false),
    SESSIONS_RETENTION_DAYS: optionalPositiveInt(30),
    SESSIONS_RETENTION_DRY_RUN: optionalBooleanFlag(false),
    S3_ENDPOINT: z.string().url(),
    S3_REGION: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    LIQPAY_PUBLIC_KEY: optionalNonEmptyString,
    LIQPAY_PRIVATE_KEY: optionalNonEmptyString,
    LIQPAY_CALLBACK_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().url().optional(),
    ),
    LIQPAY_RESULT_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().url().optional(),
    ),
    BILLING_ENFORCEMENT_ENABLED: optionalBooleanFlag(false),
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

    // Enforcement without a payment provider configured would leave every organization
    // restricted and unable to pay its way out. Dev and test may still enable it without
    // LiqPay keys, because that is exactly how the entitlement guard gets exercised locally.
    if (env.NODE_ENV === 'production' && env.BILLING_ENFORCEMENT_ENABLED) {
      for (const key of [
        'LIQPAY_PUBLIC_KEY',
        'LIQPAY_PRIVATE_KEY',
        'LIQPAY_CALLBACK_URL',
      ] as const) {
        if (!env[key]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when BILLING_ENFORCEMENT_ENABLED=true`,
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
    COOKIE_DOMAIN: optionalTrimmedNonEmptyString,
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
    COOKIE_DOMAIN: env.COOKIE_DOMAIN,
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
