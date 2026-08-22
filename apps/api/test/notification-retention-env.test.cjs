const assert = require('node:assert/strict');
const test = require('node:test');
const { apiEnvSchema } = require('@churchflow/shared');

function apiEnv(overrides = {}) {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://churchflow:churchflow@localhost:5432/churchflow?schema=public',
    WEB_APP_URL: 'https://churchflow.test',
    PLATFORM_ADMIN_EMAIL: 'admin@churchflow.test',
    S3_ENDPOINT: 'https://storage.churchflow.test',
    S3_REGION: 'auto',
    S3_BUCKET: 'churchflow',
    S3_ACCESS_KEY_ID: 'test-access-key',
    S3_SECRET_ACCESS_KEY: 'test-secret-key',
    ...overrides,
  };
}

test('retention settings fall back to their defaults when the keys are absent', () => {
  const env = apiEnvSchema.parse(apiEnv());

  assert.equal(env.NOTIFICATIONS_RETENTION_DAYS, 365);
  assert.equal(env.NOTIFICATIONS_READ_RETENTION_DAYS, 180);
  assert.equal(env.NOTIFICATIONS_RETENTION_DRY_RUN, false);
});

test('blank retention values fall back to defaults instead of failing validation', () => {
  const env = apiEnvSchema.parse(
    apiEnv({
      NOTIFICATIONS_RETENTION_DAYS: '',
      NOTIFICATIONS_READ_RETENTION_DAYS: '',
      NOTIFICATIONS_RETENTION_DRY_RUN: '',
    }),
  );

  assert.equal(env.NOTIFICATIONS_RETENTION_DAYS, 365);
  assert.equal(env.NOTIFICATIONS_READ_RETENTION_DAYS, 180);
  assert.equal(env.NOTIFICATIONS_RETENTION_DRY_RUN, false);
});

test('retention windows accept explicit values', () => {
  const env = apiEnvSchema.parse(
    apiEnv({ NOTIFICATIONS_RETENTION_DAYS: '30', NOTIFICATIONS_READ_RETENTION_DAYS: '7' }),
  );

  assert.equal(env.NOTIFICATIONS_RETENTION_DAYS, 30);
  assert.equal(env.NOTIFICATIONS_READ_RETENTION_DAYS, 7);
});

test('the dry run flag accepts the spellings an operator is likely to write', () => {
  for (const value of ['true', 'TRUE', ' True ', '1']) {
    assert.equal(
      apiEnvSchema.parse(apiEnv({ NOTIFICATIONS_RETENTION_DRY_RUN: value }))
        .NOTIFICATIONS_RETENTION_DRY_RUN,
      true,
      `expected ${JSON.stringify(value)} to enable the dry run`,
    );
  }

  for (const value of ['false', 'FALSE', '0']) {
    assert.equal(
      apiEnvSchema.parse(apiEnv({ NOTIFICATIONS_RETENTION_DRY_RUN: value }))
        .NOTIFICATIONS_RETENTION_DRY_RUN,
      false,
      `expected ${JSON.stringify(value)} to disable the dry run`,
    );
  }
});

test('a nonsensical retention window is still rejected', () => {
  const result = apiEnvSchema.safeParse(apiEnv({ NOTIFICATIONS_RETENTION_DAYS: '0' }));

  assert.equal(result.success, false);
  assert.ok(
    result.error.issues.some((issue) => issue.path.includes('NOTIFICATIONS_RETENTION_DAYS')),
  );
});
