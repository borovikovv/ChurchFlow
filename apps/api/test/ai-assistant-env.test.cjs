const assert = require('node:assert/strict');
const test = require('node:test');
const { apiEnvSchema, webEnvSchema } = require('@churchflow/shared');

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

function issuePaths(env) {
  const result = apiEnvSchema.safeParse({ ...base, ...env });
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

test('the assistant is off by default, through OpenRouter, with no model pinned', () => {
  const env = apiEnvSchema.parse(base);

  assert.equal(env.AI_ASSISTANT_ENABLED, false);
  assert.equal(env.AI_PROVIDER, 'openrouter');
  assert.equal(env.AI_MODEL, undefined);
  assert.equal(env.AI_MONTHLY_ACTION_LIMIT, 250);
  assert.equal(webEnvSchema.parse({}).AI_ASSISTANT_ENABLED, false);
});

test('an enabled assistant needs the key of the provider it uses', () => {
  assert.deepEqual(issuePaths({ AI_ASSISTANT_ENABLED: 'true' }), ['OPENROUTER_API_KEY']);
  assert.deepEqual(issuePaths({ AI_ASSISTANT_ENABLED: 'true', AI_PROVIDER: 'deepseek' }), [
    'DEEPSEEK_API_KEY',
  ]);
  assert.deepEqual(
    issuePaths({ AI_ASSISTANT_ENABLED: 'true', AI_PROVIDER: 'deepseek', OPENROUTER_API_KEY: 'k' }),
    ['DEEPSEEK_API_KEY'],
  );
  assert.deepEqual(
    issuePaths({ AI_ASSISTANT_ENABLED: 'true', AI_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'k' }),
    [],
  );
  assert.deepEqual(issuePaths({ AI_ASSISTANT_ENABLED: 'false', AI_PROVIDER: 'deepseek' }), []);
});

test('only known providers are accepted', () => {
  assert.deepEqual(issuePaths({ AI_PROVIDER: 'openai' }), ['AI_PROVIDER']);
});

test('a blank model falls back to the provider default', () => {
  assert.equal(apiEnvSchema.parse({ ...base, AI_MODEL: '   ' }).AI_MODEL, undefined);
  assert.equal(
    apiEnvSchema.parse({ ...base, AI_MODEL: 'deepseek-v4-pro' }).AI_MODEL,
    'deepseek-v4-pro',
  );
});
