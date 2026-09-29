require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  GoogleAnalyticsCallbackController,
} = require('../dist/modules/website-analytics/google-analytics-callback.controller.js');
const {
  WebsiteAnalyticsController,
} = require('../dist/modules/website-analytics/website-analytics.controller.js');
const {
  encodeGoogleOAuthFlow,
} = require('../dist/modules/website-analytics/google/google-oauth-flow-cookie.js');

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000009';
const ACTOR_ID = '00000000-0000-4000-8000-000000000002';
const FLOW = { organizationId: ORG_ID, state: 'state-1', codeVerifier: 'verifier-1' };
const WEB_APP_URL = 'https://app.example.test';

const config = {
  get: (key) => ({ WEB_APP_URL, NODE_ENV: 'test' })[key],
  getOrThrow: (key) => ({ WEB_APP_URL })[key],
};

function fakeResponse() {
  const response = { redirects: [], cookies: [], cleared: [] };
  response.redirect = (...args) => response.redirects.push(args.at(-1));
  response.cookie = (name, value, options) => response.cookies.push({ name, value, options });
  response.clearCookie = (name) => response.cleared.push(name);
  return response;
}

function requestWithFlow(flow) {
  return {
    auth: { userId: ACTOR_ID },
    headers: flow ? { cookie: `cf_ga_oauth=${encodeGoogleOAuthFlow(flow)}` } : {},
  };
}

test('the google callback forwards the answer to the organization completion route', () => {
  const response = fakeResponse();
  new GoogleAnalyticsCallbackController(config).callback(
    'code-1',
    'state-1',
    undefined,
    requestWithFlow(FLOW),
    response,
  );

  assert.deepEqual(response.redirects, [
    `../../organizations/${ORG_ID}/website/analytics/google/complete?code=code-1&state=state-1`,
  ]);
  assert.equal(
    new URL(
      response.redirects[0],
      'https://app.example.test/v1/integrations/google-analytics/callback',
    ).pathname,
    `/v1/organizations/${ORG_ID}/website/analytics/google/complete`,
  );
});

test('a callback without a flow cookie goes back to the dashboard', () => {
  const response = fakeResponse();
  new GoogleAnalyticsCallbackController(config).callback(
    'code-1',
    'state-1',
    undefined,
    requestWithFlow(null),
    response,
  );

  assert.deepEqual(response.redirects, [`${WEB_APP_URL}/dashboard`]);
});

test('completion clears the flow cookie and refuses a flow started for another organization', async () => {
  const completions = [];
  const service = {
    completeOAuth: async (input) => {
      completions.push(input);
      return { ok: true };
    },
  };
  const controller = new WebsiteAnalyticsController(service, config);

  const mismatch = fakeResponse();
  await controller.completeGoogle(
    OTHER_ORG_ID,
    'code-1',
    'state-1',
    undefined,
    requestWithFlow(FLOW),
    mismatch,
  );
  assert.deepEqual(mismatch.cleared, ['cf_ga_oauth']);
  assert.equal(completions.length, 0);
  assert.equal(
    mismatch.redirects[0],
    `${WEB_APP_URL}/dashboard/${OTHER_ORG_ID}/website/analytics?ga=error&gaReason=expired`,
  );

  const matched = fakeResponse();
  await controller.completeGoogle(
    ORG_ID,
    'code-1',
    'state-1',
    undefined,
    requestWithFlow(FLOW),
    matched,
  );
  assert.deepEqual(matched.cleared, ['cf_ga_oauth']);
  assert.deepEqual(completions, [
    { actorUserId: ACTOR_ID, flow: FLOW, code: 'code-1', state: 'state-1', error: undefined },
  ]);
  assert.equal(
    matched.redirects[0],
    `${WEB_APP_URL}/dashboard/${ORG_ID}/website/analytics?ga=connected`,
  );
});

test('connect sets a short-lived httpOnly flow cookie before sending the owner to google', () => {
  const service = {
    oauthAvailable: true,
    beginOAuth: (organizationId) => ({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1',
      flow: { ...FLOW, organizationId },
    }),
  };
  const response = fakeResponse();
  new WebsiteAnalyticsController(service, config).connectGoogle(ORG_ID, response);

  assert.equal(response.cookies.length, 1);
  const [cookie] = response.cookies;
  assert.equal(cookie.name, 'cf_ga_oauth');
  assert.equal(cookie.options.httpOnly, true);
  assert.equal(cookie.options.sameSite, 'lax');
  assert.equal(cookie.options.maxAge, 10 * 60 * 1000);
  assert.deepEqual(response.redirects, ['https://accounts.google.com/o/oauth2/v2/auth?x=1']);
});
