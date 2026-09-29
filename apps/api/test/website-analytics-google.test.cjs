const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const test = require('node:test');
const { decryptSecret, encryptSecret } = require('../dist/common/crypto/secret-box.js');
const { loggableUrl } = require('../dist/common/http/loggable-url.js');
const {
  buildGoogleAuthorizationUrl,
  createGoogleOAuthChallenge,
  grantsAnalyticsScope,
  readIdTokenEmail,
  statesMatch,
  GOOGLE_ANALYTICS_READONLY_SCOPE,
} = require('../dist/modules/website-analytics/google/google-oauth.js');
const {
  decodeGoogleOAuthFlow,
  encodeGoogleOAuthFlow,
} = require('../dist/modules/website-analytics/google/google-oauth-flow-cookie.js');
const {
  buildReportRequests,
  toWebsiteAnalyticsReport,
} = require('../dist/modules/website-analytics/google/google-analytics-report.js');

const ORG_ID = '00000000-0000-4000-8000-000000000001';

function row(dimensions, metrics) {
  return {
    dimensionValues: dimensions.map((value) => ({ value })),
    metricValues: metrics.map((value) => ({ value: String(value) })),
  };
}

function report(rows, timeZone = 'UTC') {
  return { rows, metadata: { timeZone } };
}

test('an encrypted secret decrypts with its key and never contains the plaintext', () => {
  const key = randomBytes(32);
  const stored = encryptSecret('1//refresh-token', key);

  assert.equal(stored.includes('refresh-token'), false);
  assert.match(stored, /^v1:/);
  assert.equal(decryptSecret(stored, key), '1//refresh-token');
  assert.notEqual(encryptSecret('1//refresh-token', key), stored, 'iv must be random');
});

test('a tampered secret or the wrong key fails instead of decrypting to garbage', () => {
  const key = randomBytes(32);
  const stored = encryptSecret('1//refresh-token', key);
  const [version, iv, tag, ciphertext] = stored.split(':');
  const flipped = `${ciphertext.slice(0, -2)}${ciphertext.endsWith('AA') ? 'BB' : 'AA'}`;

  assert.throws(() => decryptSecret(stored, randomBytes(32)));
  assert.throws(() => decryptSecret([version, iv, tag, flipped].join(':'), key));
  assert.throws(() => decryptSecret(`v2:${iv}:${tag}:${ciphertext}`, key));
  assert.throws(() => decryptSecret('not-a-secret', key));
  assert.throws(
    () => decryptSecret([version, iv, tag.slice(0, 6), ciphertext].join(':'), key),
    'a truncated auth tag must be rejected',
  );
});

test('logged urls hide an oauth code and state but keep the rest of the query', () => {
  assert.equal(
    loggableUrl('/v1/integrations/google-analytics/callback?state=abc&code=4/xyz&scope=email'),
    '/v1/integrations/google-analytics/callback?state=redacted&code=redacted&scope=email',
  );
  assert.equal(
    loggableUrl('/v1/organizations/1/members?page=2'),
    '/v1/organizations/1/members?page=2',
  );
  assert.equal(loggableUrl('/v1/health'), '/v1/health');
});

test('the authorization url asks for read-only analytics, offline access and PKCE', () => {
  const challenge = createGoogleOAuthChallenge();
  const url = new URL(
    buildGoogleAuthorizationUrl({
      clientId: 'client-id',
      redirectUri: 'https://app.example.test/v1/integrations/google-analytics/callback',
      state: challenge.state,
      codeChallenge: challenge.codeChallenge,
    }),
  );

  assert.equal(url.origin, 'https://accounts.google.com');
  assert.deepEqual(url.searchParams.get('scope').split(' '), [
    'openid',
    'email',
    GOOGLE_ANALYTICS_READONLY_SCOPE,
  ]);
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('state'), challenge.state);
  assert.notEqual(challenge.codeChallenge, challenge.codeVerifier);
  assert.ok(![...url.searchParams.values()].includes(challenge.codeVerifier));
});

test('state comparison, granted scopes and the id token email', () => {
  assert.equal(statesMatch('abc', 'abc'), true);
  assert.equal(statesMatch('abc', 'abd'), false);
  assert.equal(statesMatch('abc', 'abcd'), false);

  assert.equal(grantsAnalyticsScope(`openid ${GOOGLE_ANALYTICS_READONLY_SCOPE} email`), true);
  assert.equal(grantsAnalyticsScope('openid email'), false);
  assert.equal(grantsAnalyticsScope(undefined), false);

  const claims = Buffer.from(JSON.stringify({ email: 'owner@example.test' })).toString('base64url');
  assert.equal(readIdTokenEmail(`header.${claims}.signature`), 'owner@example.test');
  assert.equal(readIdTokenEmail(undefined), null);
  assert.equal(readIdTokenEmail('header.not-json.signature'), null);
  const noEmail = Buffer.from(JSON.stringify({ sub: '1' })).toString('base64url');
  assert.equal(readIdTokenEmail(`header.${noEmail}.signature`), null);
});

test('the flow cookie round-trips and rejects anything it did not write', () => {
  const flow = { organizationId: ORG_ID, state: 'state', codeVerifier: 'verifier' };

  assert.deepEqual(decodeGoogleOAuthFlow(encodeGoogleOAuthFlow(flow)), flow);
  assert.equal(decodeGoogleOAuthFlow(undefined), null);
  assert.equal(decodeGoogleOAuthFlow('%%%'), null);
  assert.equal(
    decodeGoogleOAuthFlow(encodeGoogleOAuthFlow({ ...flow, organizationId: 'not-a-uuid' })),
    null,
  );
});

test('the report requests cover the whole range ending today', () => {
  const requests = buildReportRequests('7d');

  assert.equal(requests.length, 5);
  for (const request of requests) {
    assert.deepEqual(request.dateRanges, [{ startDate: '6daysAgo', endDate: 'today' }]);
  }
  assert.deepEqual(buildReportRequests('90d')[0].dateRanges, [
    { startDate: '89daysAgo', endDate: 'today' },
  ]);
});

test('a report maps totals, rankings and a trend with every day of the range', () => {
  const now = new Date('2026-09-29T10:00:00Z');
  const result = toWebsiteAnalyticsReport(
    '7d',
    [
      report([row([], [120, 480, 150])]),
      report([row(['20260923'], [10, 40]), row(['20260929'], [30, 90])]),
      report([row(['/'], [300]), row(['/about'], [80])]),
      report([row(['Organic Search'], [90]), row([''], [5])]),
      report([row(['Ukraine'], [100]), row(['(not set)'], [2])]),
    ],
    now,
  );

  assert.deepEqual(result.totals, { users: 120, pageViews: 480, sessions: 150 });
  assert.deepEqual(
    result.trend.map((point) => point.date),
    [
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
    ],
  );
  assert.deepEqual(result.trend[0], { date: '2026-09-23', users: 10, pageViews: 40 });
  assert.deepEqual(result.trend[1], { date: '2026-09-24', users: 0, pageViews: 0 });
  assert.deepEqual(result.trend[6], { date: '2026-09-29', users: 30, pageViews: 90 });
  assert.deepEqual(result.topPages, [
    { label: '/', value: 300 },
    { label: '/about', value: 80 },
  ]);
  assert.deepEqual(result.trafficSources[1], { label: '(not set)', value: 5 });
  assert.deepEqual(result.countries[1], { label: '(not set)', value: 2 });
  assert.equal(result.range, '7d');
  assert.equal(result.generatedAt, now.toISOString());
});

test('a property with no traffic yet reports zeros and empty lists', () => {
  const result = toWebsiteAnalyticsReport(
    '28d',
    [report([]), report([]), report([]), report([]), report([])],
    new Date('2026-09-29T10:00:00Z'),
  );

  assert.deepEqual(result.totals, { users: 0, pageViews: 0, sessions: 0 });
  assert.equal(result.trend.length, 28);
  assert.ok(result.trend.every((point) => point.users === 0 && point.pageViews === 0));
  assert.deepEqual(result.topPages, []);
  assert.deepEqual(result.trafficSources, []);
  assert.deepEqual(result.countries, []);
});

test('the trend ends on today in the property time zone, not in UTC', () => {
  // 23:30 UTC on the 29th is already the 30th in Kyiv.
  const now = new Date('2026-09-29T23:30:00Z');
  const kyiv = toWebsiteAnalyticsReport('7d', [report([]), report([], 'Europe/Kyiv')], now);
  const unknownZone = toWebsiteAnalyticsReport('7d', [report([]), report([], 'Mars/Base')], now);

  assert.equal(kyiv.trend.at(-1).date, '2026-09-30');
  assert.equal(unknownZone.trend.at(-1).date, '2026-09-29');
});

test('google analytics oauth settings are optional but all-or-nothing', () => {
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
  const google = {
    GOOGLE_OAUTH_CLIENT_ID: 'client',
    GOOGLE_OAUTH_CLIENT_SECRET: 'secret',
    GOOGLE_ANALYTICS_REDIRECT_URI: 'https://example.test/v1/integrations/google-analytics/callback',
    INTEGRATION_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  };

  assert.equal(apiEnvSchema.safeParse(base).success, true);
  assert.equal(apiEnvSchema.safeParse({ ...base, ...google }).success, true);

  const partial = apiEnvSchema.safeParse({ ...base, GOOGLE_OAUTH_CLIENT_ID: 'client' });
  assert.equal(partial.success, false);
  assert.deepEqual(partial.error.issues.map((issue) => issue.path[0]).sort(), [
    'GOOGLE_ANALYTICS_REDIRECT_URI',
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'INTEGRATION_ENCRYPTION_KEY',
  ]);

  const shortKey = apiEnvSchema.safeParse({
    ...base,
    ...google,
    INTEGRATION_ENCRYPTION_KEY: randomBytes(16).toString('base64'),
  });
  assert.equal(shortKey.success, false);
});
