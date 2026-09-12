const assert = require('node:assert/strict');
const test = require('node:test');
const { apiEnvSchema } = require('@churchflow/shared');
const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost/churchflow',
  WEB_APP_URL: 'https://example.test',
  PLATFORM_ADMIN_EMAIL: 'admin@example.test',
  S3_ENDPOINT: 'https://storage.example.test',
  S3_REGION: 'auto',
  S3_BUCKET: 'test',
  S3_ACCESS_KEY_ID: 'test',
  S3_SECRET_ACCESS_KEY: 'test',
};
const CALLBACK_URL = 'https://example.test/billing/liqpay/callback';

test('billing defaults to live mode and refuses sandbox keys unless explicitly configured', () => {
  assert.equal(apiEnvSchema.parse(base).LIQPAY_MODE, 'live');
  assert.equal(
    apiEnvSchema.safeParse({
      ...base,
      LIQPAY_PUBLIC_KEY: 'sandbox_public',
      LIQPAY_PRIVATE_KEY: 'sandbox_private',
    }).success,
    false,
  );
  assert.equal(
    apiEnvSchema.safeParse({
      ...base,
      LIQPAY_MODE: 'sandbox',
      LIQPAY_PUBLIC_KEY: 'sandbox_public',
      LIQPAY_PRIVATE_KEY: 'sandbox_private',
      LIQPAY_CALLBACK_URL: CALLBACK_URL,
    }).success,
    true,
  );
  assert.equal(
    apiEnvSchema.safeParse({
      ...base,
      LIQPAY_MODE: 'sandbox',
      LIQPAY_PUBLIC_KEY: 'sandbox_public',
      LIQPAY_PRIVATE_KEY: 'live_private',
    }).success,
    false,
  );
});

test('a production Node runtime on stage may explicitly use sandbox billing', () => {
  const result = apiEnvSchema.safeParse({
    ...base,
    NODE_ENV: 'production',
    TELEGRAM_CLIENT_ID: 'test',
    TELEGRAM_CLIENT_SECRET: 'test',
    TELEGRAM_REDIRECT_URI: 'https://example.test/callback',
    LIQPAY_MODE: 'sandbox',
    LIQPAY_PUBLIC_KEY: 'sandbox_public',
    LIQPAY_PRIVATE_KEY: 'sandbox_private',
    LIQPAY_CALLBACK_URL: CALLBACK_URL,
  });
  assert.equal(result.success, true);
});

test('keys without a callback address cannot be configured, enforcement or not', () => {
  // A checkout is payable as soon as the keys exist. Without somewhere for LiqPay to report the
  // payment the card is charged and the subscription never activates, so the address is part of
  // being able to take money rather than part of enforcing payment.
  assert.equal(
    apiEnvSchema.safeParse({
      ...base,
      LIQPAY_PUBLIC_KEY: 'live_public',
      LIQPAY_PRIVATE_KEY: 'live_private',
    }).success,
    false,
  );
  assert.equal(
    apiEnvSchema.safeParse({
      ...base,
      LIQPAY_PUBLIC_KEY: 'live_public',
      LIQPAY_PRIVATE_KEY: 'live_private',
      LIQPAY_CALLBACK_URL: CALLBACK_URL,
    }).success,
    true,
  );
  // An install with no payment provider at all is still a valid one.
  assert.equal(apiEnvSchema.safeParse(base).success, true);
});

test('enforcement in production still requires the keys themselves', () => {
  const result = apiEnvSchema.safeParse({
    ...base,
    NODE_ENV: 'production',
    TELEGRAM_CLIENT_ID: 'test',
    TELEGRAM_CLIENT_SECRET: 'test',
    TELEGRAM_REDIRECT_URI: 'https://example.test/callback',
    BILLING_ENFORCEMENT_ENABLED: 'true',
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.error.issues.map((issue) => issue.path[0]).sort(),
    ['LIQPAY_PRIVATE_KEY', 'LIQPAY_PUBLIC_KEY'],
  );
});
