const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const test = require('node:test');
const { encryptSecret } = require('../dist/common/crypto/secret-box.js');
const {
  GoogleApiError,
} = require('../dist/modules/website-analytics/google/google-analytics.client.js');
const {
  WebsiteAnalyticsRepository,
} = require('../dist/modules/website-analytics/repositories/website-analytics.repository.js');
const {
  WebsiteAnalyticsService,
} = require('../dist/modules/website-analytics/website-analytics.service.js');
const {
  websiteAnalyticsReturnUrl,
} = require('../dist/modules/website-analytics/website-analytics-return-url.js');

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const ACTOR_ID = '00000000-0000-4000-8000-000000000002';
const KEY = randomBytes(32);
const READONLY = 'https://www.googleapis.com/auth/analytics.readonly';
const FLOW = { organizationId: ORG_ID, state: 'state-1', codeVerifier: 'verifier-1' };

function config(values = {}) {
  const all = {
    GOOGLE_OAUTH_CLIENT_ID: 'client',
    GOOGLE_OAUTH_CLIENT_SECRET: 'secret',
    GOOGLE_ANALYTICS_REDIRECT_URI:
      'https://app.example.test/v1/integrations/google-analytics/callback',
    INTEGRATION_ENCRYPTION_KEY: KEY.toString('base64'),
    ...values,
  };

  return {
    get: (key) => all[key],
    getOrThrow: (key) => {
      if (!all[key]) throw new Error(`missing ${key}`);
      return all[key];
    },
  };
}

function storedIntegration(overrides = {}) {
  return {
    id: 'integration-1',
    organizationId: ORG_ID,
    mode: 'OAUTH',
    status: 'CONNECTED',
    measurementId: 'G-OLD1234',
    googleAccountEmail: 'owner@example.test',
    gaAccountId: '100',
    propertyId: '200',
    propertyDisplayName: 'Grace website',
    streamId: '300',
    encryptedRefreshToken: encryptSecret('refresh-1', KEY),
    updatedAt: new Date('2026-09-29T00:00:00Z'),
    ...overrides,
  };
}

function fakeRepository(integration = storedIntegration()) {
  const calls = [];
  return {
    calls,
    findByOrganizationId: async () => integration,
    connectOAuth: async (input) => calls.push(['connectOAuth', input]),
    selectProperty: async (input) => calls.push(['selectProperty', input]),
    setManualMeasurementId: async (input) => calls.push(['setManual', input]),
    disconnect: async (input) => calls.push(['disconnect', input]),
    markNeedsReauth: async (stored) => calls.push(['markNeedsReauth', stored]),
  };
}

function fakeGoogle(overrides = {}) {
  const calls = [];
  const google = {
    calls,
    exchangeCode: async (input) => {
      calls.push(['exchangeCode', input]);
      return {
        access_token: 'access-1',
        expires_in: 3600,
        refresh_token: 'refresh-new',
        scope: `openid email ${READONLY}`,
      };
    },
    refreshAccessToken: async (refreshToken) => {
      calls.push(['refresh', refreshToken]);
      return { access_token: 'access-2', expires_in: 3600 };
    },
    revokeToken: async (token) => calls.push(['revoke', token]),
    listAccountSummaries: async () => [
      {
        account: 'accounts/100',
        displayName: 'Grace',
        propertySummaries: [{ property: 'properties/200', displayName: 'Grace website' }],
      },
    ],
    listWebDataStreams: async () => [
      { id: '300', displayName: 'Web', measurementId: 'G-NEW5678', defaultUri: null },
    ],
    runReports: async () => {
      calls.push(['runReports']);
      return [];
    },
    ...overrides,
  };

  return google;
}

function service(repository, google, configValues) {
  return new WebsiteAnalyticsService(repository, google, config(configValues));
}

async function rejectsWithCode(promise, status, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.getStatus(), status);
    assert.equal(error.getResponse().code, code);
    return true;
  });
}

test('the status never includes the stored refresh token', async () => {
  const status = await service(fakeRepository(), fakeGoogle()).getStatus(ORG_ID);

  assert.equal(status.oauthAvailable, true);
  assert.equal(status.integration.measurementId, 'G-OLD1234');
  assert.equal(JSON.stringify(status).includes('encryptedRefreshToken'), false);
  assert.equal(JSON.stringify(status).includes('v1:'), false);
});

test('oauth is unavailable unless every google setting is configured', async () => {
  const analytics = service(fakeRepository(null), fakeGoogle(), { INTEGRATION_ENCRYPTION_KEY: '' });

  assert.equal((await analytics.getStatus(ORG_ID)).oauthAvailable, false);
  assert.throws(() => analytics.beginOAuth(ORG_ID));
  await rejectsWithCode(analytics.getReport(ORG_ID, '28d'), 503, 'GA_OAUTH_UNAVAILABLE');
});

test('completing consent stores an encrypted refresh token for the flow organization', async () => {
  const repository = fakeRepository(null);
  const google = fakeGoogle();
  const completion = await service(repository, google).completeOAuth({
    actorUserId: ACTOR_ID,
    flow: FLOW,
    code: 'code-1',
    state: 'state-1',
    error: undefined,
  });

  assert.deepEqual(completion, { ok: true });
  assert.equal(google.calls[0][1].codeVerifier, 'verifier-1');
  const [, stored] = repository.calls.find(([name]) => name === 'connectOAuth');
  assert.equal(stored.organizationId, ORG_ID);
  assert.equal(stored.actorUserId, ACTOR_ID);
  assert.notEqual(stored.encryptedRefreshToken, 'refresh-new');
  assert.equal(stored.encryptedRefreshToken.includes('refresh-new'), false);
});

test('consent fails closed on a denial, a stale state or a missing scope', async () => {
  const input = { actorUserId: ACTOR_ID, flow: FLOW, code: 'code-1', state: 'state-1' };

  assert.deepEqual(
    await service(fakeRepository(null), fakeGoogle()).completeOAuth({
      ...input,
      error: 'access_denied',
    }),
    { ok: false, reason: 'denied' },
  );
  assert.deepEqual(
    await service(fakeRepository(null), fakeGoogle()).completeOAuth({
      ...input,
      state: 'other',
      error: undefined,
    }),
    { ok: false, reason: 'expired' },
  );

  const scoped = fakeRepository(null);
  const scopedGoogle = fakeGoogle({
    exchangeCode: async () => ({
      access_token: 'access-1',
      expires_in: 3600,
      refresh_token: 'refresh-new',
      scope: 'openid email',
    }),
  });
  assert.deepEqual(
    await service(scoped, scopedGoogle).completeOAuth({ ...input, error: undefined }),
    { ok: false, reason: 'scope' },
  );
  assert.deepEqual(scopedGoogle.calls, [['revoke', 'refresh-new']]);
  assert.equal(
    scoped.calls.some(([name]) => name === 'connectOAuth'),
    false,
  );
});

test('a failed code exchange reports the exchange, not a server error', async () => {
  const google = fakeGoogle({
    exchangeCode: async () => {
      throw new GoogleApiError('failed', 'boom');
    },
  });

  assert.deepEqual(
    await service(fakeRepository(null), google).completeOAuth({
      actorUserId: ACTOR_ID,
      flow: FLOW,
      code: 'code-1',
      state: 'state-1',
      error: undefined,
    }),
    { ok: false, reason: 'exchange' },
  );
});

test('only a property and web stream the connected account can read may be selected', async () => {
  const repository = fakeRepository();
  const analytics = service(repository, fakeGoogle());

  await assert.rejects(
    analytics.selectProperty(ORG_ID, ACTOR_ID, { propertyId: '999', streamId: '300' }),
    (error) => error.getStatus() === 404,
  );
  await assert.rejects(
    analytics.selectProperty(ORG_ID, ACTOR_ID, { propertyId: '200', streamId: '999' }),
    (error) => error.getStatus() === 404,
  );

  await analytics.selectProperty(ORG_ID, ACTOR_ID, { propertyId: '200', streamId: '300' });
  const [, selection] = repository.calls.find(([name]) => name === 'selectProperty');
  assert.deepEqual(selection, {
    organizationId: ORG_ID,
    actorUserId: ACTOR_ID,
    gaAccountId: '100',
    propertyId: '200',
    propertyDisplayName: 'Grace website',
    streamId: '300',
    measurementId: 'G-NEW5678',
  });
});

test('a revoked grant marks the integration for reconnect and answers GA_REAUTH_REQUIRED', async () => {
  const integration = storedIntegration();
  const repository = fakeRepository(integration);
  const google = fakeGoogle({
    refreshAccessToken: async () => {
      throw new GoogleApiError('auth', 'invalid_grant');
    },
  });

  await rejectsWithCode(
    service(repository, google).getReport(ORG_ID, '28d'),
    409,
    'GA_REAUTH_REQUIRED',
  );
  // The failing grant itself is flagged, so a reconnect finished meanwhile is not.
  assert.deepEqual(repository.calls, [['markNeedsReauth', integration]]);
});

test('a property the account cannot read asks for another property, not a reconnect', async () => {
  const repository = fakeRepository();
  const google = fakeGoogle({
    runReports: async () => {
      throw new GoogleApiError('forbidden', 'permission denied');
    },
  });

  await rejectsWithCode(
    service(repository, google).getReport(ORG_ID, '28d'),
    409,
    'GA_PROPERTY_FORBIDDEN',
  );
  assert.deepEqual(repository.calls, []);
});

test('reconnecting with another google account revokes the old grant, the same account does not', async () => {
  const idToken = (email) =>
    `header.${Buffer.from(JSON.stringify({ email })).toString('base64url')}.signature`;
  const reconnect = async (email) => {
    const google = fakeGoogle({
      exchangeCode: async () => ({
        access_token: 'access-1',
        expires_in: 3600,
        refresh_token: 'refresh-new',
        scope: `openid email ${READONLY}`,
        id_token: idToken(email),
      }),
    });
    await service(fakeRepository(), google).completeOAuth({
      actorUserId: ACTOR_ID,
      flow: FLOW,
      code: 'code-1',
      state: 'state-1',
      error: undefined,
    });
    return google.calls.filter(([call]) => call === 'revoke');
  };

  assert.deepEqual(await reconnect('someone-else@example.test'), [['revoke', 'refresh-1']]);
  assert.deepEqual(await reconnect('owner@example.test'), []);
});

test('an integration already waiting for reconnect does not call google', async () => {
  const google = fakeGoogle();

  await rejectsWithCode(
    service(fakeRepository(storedIntegration({ status: 'NEEDS_REAUTH' })), google).getReport(
      ORG_ID,
      '7d',
    ),
    409,
    'GA_REAUTH_REQUIRED',
  );
  assert.equal(google.calls.length, 0);
});

test('google quota and outages surface as retryable errors without details', async () => {
  const limited = fakeGoogle({
    runReports: async () => {
      throw new GoogleApiError('rate_limited', 'quota');
    },
  });
  const down = fakeGoogle({
    runReports: async () => {
      throw new GoogleApiError('failed', 'status 500 internal detail');
    },
  });

  await rejectsWithCode(
    service(fakeRepository(), limited).getReport(ORG_ID, '7d'),
    503,
    'GA_UPSTREAM_FAILED',
  );
  await assert.rejects(service(fakeRepository(), down).getReport(ORG_ID, '7d'), (error) => {
    assert.equal(error.getStatus(), 502);
    assert.equal(error.message.includes('internal detail'), false);
    return true;
  });
});

test('reports are cached per range and the access token is reused', async () => {
  const google = fakeGoogle();
  const analytics = service(fakeRepository(), google);

  await analytics.getReport(ORG_ID, '7d');
  await analytics.getReport(ORG_ID, '7d');
  await analytics.getReport(ORG_ID, '28d');

  assert.equal(google.calls.filter(([name]) => name === 'runReports').length, 2);
  assert.deepEqual(
    google.calls.filter(([name]) => name === 'refresh'),
    [['refresh', 'refresh-1']],
  );
});

test('a report needs a google connection with a selected property', async () => {
  await rejectsWithCode(
    service(fakeRepository(null), fakeGoogle()).getReport(ORG_ID, '7d'),
    404,
    'GA_NOT_CONNECTED',
  );
  await rejectsWithCode(
    service(
      fakeRepository(storedIntegration({ mode: 'MANUAL', encryptedRefreshToken: null })),
      fakeGoogle(),
    ).getReport(ORG_ID, '7d'),
    404,
    'GA_NOT_CONNECTED',
  );
  await rejectsWithCode(
    service(fakeRepository(storedIntegration({ propertyId: null })), fakeGoogle()).getReport(
      ORG_ID,
      '7d',
    ),
    409,
    'GA_PROPERTY_NOT_SELECTED',
  );
});

test('disconnecting and switching to a manual id revoke the stored google grant', async () => {
  for (const act of [
    (analytics) => analytics.disconnect(ORG_ID, ACTOR_ID),
    (analytics) => analytics.setManualMeasurementId(ORG_ID, ACTOR_ID, 'G-MANUAL1'),
  ]) {
    const google = fakeGoogle();
    await act(service(fakeRepository(), google));
    assert.deepEqual(google.calls, [['revoke', 'refresh-1']]);
  }

  await rejectsWithCode(
    service(fakeRepository(null), fakeGoogle()).disconnect(ORG_ID, ACTOR_ID),
    404,
    'GA_NOT_CONNECTED',
  );
});

test('the owner returns to the analytics page with the outcome in the query', () => {
  assert.equal(
    websiteAnalyticsReturnUrl('https://app.example.test', ORG_ID, { ok: true }),
    `https://app.example.test/dashboard/${ORG_ID}/website/analytics?ga=connected`,
  );
  assert.equal(
    websiteAnalyticsReturnUrl('https://app.example.test', ORG_ID, { ok: false, reason: 'scope' }),
    `https://app.example.test/dashboard/${ORG_ID}/website/analytics?ga=error&gaReason=scope`,
  );
});

function auditingPrisma(existing = storedIntegration()) {
  const auditRows = [];
  const writes = [];
  const tx = {
    websiteAnalyticsIntegration: {
      upsert: async (args) => {
        writes.push(['upsert', args]);
        return { ...existing, ...args.update };
      },
      update: async (args) => {
        writes.push(['update', args]);
        return { ...existing, ...args.data };
      },
      delete: async () => existing,
    },
    auditLog: {
      create: async ({ data }) => {
        auditRows.push(data);
        return data;
      },
    },
  };

  return { prisma: { $transaction: async (callback) => callback(tx) }, auditRows, writes };
}

test('every integration change writes its audit row in the same transaction', async () => {
  const cases = [
    [
      (repository) =>
        repository.connectOAuth({
          organizationId: ORG_ID,
          actorUserId: ACTOR_ID,
          encryptedRefreshToken: 'v1:x:y:z',
          googleAccountEmail: 'owner@example.test',
        }),
      'CONNECT_GOOGLE_ANALYTICS',
      { mode: 'OAUTH' },
    ],
    [
      (repository) =>
        repository.selectProperty({
          organizationId: ORG_ID,
          actorUserId: ACTOR_ID,
          gaAccountId: '100',
          propertyId: '200',
          propertyDisplayName: 'Grace website',
          streamId: '300',
          measurementId: 'G-NEW5678',
        }),
      'UPDATE_GOOGLE_ANALYTICS_PROPERTY',
      { propertyId: '200', streamId: '300', measurementId: 'G-NEW5678' },
    ],
    [
      (repository) =>
        repository.setManualMeasurementId({
          organizationId: ORG_ID,
          actorUserId: ACTOR_ID,
          measurementId: 'G-MANUAL1',
        }),
      'SET_GOOGLE_ANALYTICS_MEASUREMENT_ID',
      { measurementId: 'G-MANUAL1' },
    ],
    [
      (repository) => repository.disconnect({ organizationId: ORG_ID, actorUserId: ACTOR_ID }),
      'DISCONNECT_GOOGLE_ANALYTICS',
      { mode: 'OAUTH', measurementId: 'G-OLD1234' },
    ],
  ];

  for (const [act, action, metadata] of cases) {
    const { prisma, auditRows } = auditingPrisma();
    await act(new WebsiteAnalyticsRepository(prisma));

    assert.equal(auditRows.length, 1, action);
    assert.deepEqual(auditRows[0], {
      organizationId: ORG_ID,
      actorUserId: ACTOR_ID,
      action,
      entityType: 'WebsiteAnalyticsIntegration',
      entityId: 'integration-1',
      metadata,
    });
    assert.equal(JSON.stringify(auditRows[0]).includes('v1:'), false, 'no token in the audit');
  }
});

test('a manual id clears every trace of the google connection', async () => {
  const { prisma, writes } = auditingPrisma();
  await new WebsiteAnalyticsRepository(prisma).setManualMeasurementId({
    organizationId: ORG_ID,
    actorUserId: ACTOR_ID,
    measurementId: 'G-MANUAL1',
  });

  const [, upsert] = writes[0];
  assert.deepEqual(upsert.update, {
    mode: 'MANUAL',
    status: 'CONNECTED',
    measurementId: 'G-MANUAL1',
    encryptedRefreshToken: null,
    googleAccountEmail: null,
    gaAccountId: null,
    propertyId: null,
    propertyDisplayName: null,
    streamId: null,
  });
});

test('marking a grant for reconnect only matches the token that failed', async () => {
  const updates = [];
  const repository = new WebsiteAnalyticsRepository({
    websiteAnalyticsIntegration: { updateMany: async (args) => updates.push(args) },
  });

  await repository.markNeedsReauth({ organizationId: ORG_ID, encryptedRefreshToken: 'v1:a:b:c' });

  assert.deepEqual(updates, [
    {
      where: { organizationId: ORG_ID, mode: 'OAUTH', encryptedRefreshToken: 'v1:a:b:c' },
      data: { status: 'NEEDS_REAUTH' },
    },
  ]);
});

test('a reconnect keeps the chosen property and measurement id', async () => {
  const { prisma, writes } = auditingPrisma();
  await new WebsiteAnalyticsRepository(prisma).connectOAuth({
    organizationId: ORG_ID,
    actorUserId: ACTOR_ID,
    encryptedRefreshToken: 'v1:x:y:z',
    googleAccountEmail: 'owner@example.test',
  });

  const [, upsert] = writes[0];
  assert.deepEqual(Object.keys(upsert.update).sort(), [
    'encryptedRefreshToken',
    'googleAccountEmail',
    'mode',
    'status',
  ]);
});
