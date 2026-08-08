const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const test = require('node:test');
const { apiEnvSchema, normalizePem, webEnvSchema } = require('@churchflow/shared');

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });

function escapedPem(value) {
  return value.replace(/\n/g, '\\n');
}

function doubleEscapedPem(value) {
  return value.replace(/\n/g, '\\\\n');
}

function apiEnv(overrides = {}) {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://churchflow:churchflow@localhost:5432/churchflow?schema=public',
    JWT_ACCESS_PUBLIC_KEY: publicPem,
    JWT_ACCESS_PRIVATE_KEY: privatePem,
    JWT_REFRESH_PUBLIC_KEY: publicPem,
    JWT_REFRESH_PRIVATE_KEY: privatePem,
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

test('normalizePem preserves PEM values with real newlines', () => {
  assert.equal(normalizePem(publicPem), publicPem);
});

test('normalizePem supports one escaped newline per PEM line break', () => {
  assert.equal(normalizePem(escapedPem(publicPem)), publicPem);
});

test('normalizePem supports double escaped newline sequences without leaving backslashes', () => {
  const input = '-----BEGIN PUBLIC KEY-----\\\\nMIIB...\\\\n-----END PUBLIC KEY-----\\\\n';
  const expected = '-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----\n';

  assert.equal(normalizePem(input), expected);
  assert.equal(normalizePem(doubleEscapedPem(publicPem)), publicPem);
});

test('normalizePem strips matching external quotes', () => {
  assert.equal(normalizePem(`"${escapedPem(publicPem)}"`), publicPem);
  assert.equal(normalizePem(`'${escapedPem(publicPem)}'`), publicPem);
});

test('normalizePem is idempotent', () => {
  const normalized = normalizePem(doubleEscapedPem(publicPem));

  assert.equal(normalizePem(normalized), normalized);
});

test('JWT env schemas normalize and import valid public and private PEM keys', () => {
  const parsedApiEnv = apiEnvSchema.parse(
    apiEnv({
      JWT_ACCESS_PUBLIC_KEY: doubleEscapedPem(publicPem),
      JWT_ACCESS_PRIVATE_KEY: `"${escapedPem(privatePem)}"`,
      JWT_REFRESH_PUBLIC_KEY: escapedPem(publicPem),
      JWT_REFRESH_PRIVATE_KEY: `'${doubleEscapedPem(privatePem)}'`,
    }),
  );

  assert.equal(parsedApiEnv.JWT_ACCESS_PUBLIC_KEY, publicPem);
  assert.equal(parsedApiEnv.JWT_ACCESS_PRIVATE_KEY, privatePem);
  assert.equal(parsedApiEnv.JWT_REFRESH_PUBLIC_KEY, publicPem);
  assert.equal(parsedApiEnv.JWT_REFRESH_PRIVATE_KEY, privatePem);

  const parsedWebEnv = webEnvSchema.parse({
    NODE_ENV: 'production',
    NEXT_PUBLIC_WEB_URL: 'https://churchflow.test',
    NEXT_PUBLIC_API_URL: 'https://api.churchflow.test/v1',
    API_INTERNAL_URL: 'http://api:4000/v1',
    JWT_ACCESS_PUBLIC_KEY: doubleEscapedPem(publicPem),
  });

  assert.equal(parsedWebEnv.JWT_ACCESS_PUBLIC_KEY, publicPem);
});

test('COOKIE_DOMAIN is optional and blank values normalize to undefined', () => {
  for (const cookieDomain of [undefined, '', '   ']) {
    assert.equal(
      apiEnvSchema.parse(apiEnv({ COOKIE_DOMAIN: cookieDomain })).COOKIE_DOMAIN,
      undefined,
    );
  }

  for (const cookieDomain of [undefined, '', '   ']) {
    const parsedWebEnv = webEnvSchema.parse({
      NODE_ENV: 'production',
      NEXT_PUBLIC_WEB_URL: 'https://churchflow.test',
      NEXT_PUBLIC_API_URL: 'https://api.churchflow.test/v1',
      API_INTERNAL_URL: 'http://api:4000/v1',
      JWT_ACCESS_PUBLIC_KEY: publicPem,
      COOKIE_DOMAIN: cookieDomain,
    });

    assert.equal(parsedWebEnv.COOKIE_DOMAIN, undefined);
  }

  assert.equal(
    apiEnvSchema.parse(apiEnv({ COOKIE_DOMAIN: '  churchflow.test  ' })).COOKIE_DOMAIN,
    'churchflow.test',
  );
});

test('JWT env schemas reject invalid PEM keys without exposing the key value', () => {
  const invalidPublicPem =
    '-----BEGIN PUBLIC KEY-----\nnot-a-valid-key\n-----END PUBLIC KEY-----\n';
  const result = apiEnvSchema.safeParse(apiEnv({ JWT_ACCESS_PUBLIC_KEY: invalidPublicPem }));

  assert.equal(result.success, false);
  const message = result.error.issues.map((issue) => issue.message).join('\n');

  assert.match(message, /JWT_ACCESS_PUBLIC_KEY/);
  assert.doesNotMatch(message, /not-a-valid-key/);
});
