const assert = require('node:assert/strict');
const test = require('node:test');

const { createHash, generateKeyPairSync, sign } = require('node:crypto');
const { AuthController } = require('../dist/modules/auth/auth.controller.js');
const { AuthService } = require('../dist/modules/auth/auth.service.js');
const {
  OrganizationRequestsService,
  generateOrganizationSlug,
} = require('../dist/modules/organization-requests/organization-requests.service.js');
const { InvitationsService } = require('../dist/modules/invitations/invitations.service.js');
const { MembershipsService } = require('../dist/modules/memberships/memberships.service.js');

function createUserLocaleService(locale = 'en') {
  return {
    forUser: async () => locale,
    forEmail: async () => null,
    forRecipient: async () => locale,
  };
}

const telegramClaims = {
  iss: 'https://oauth.telegram.org',
  aud: 'churchflow',
  sub: 'telegram-user-1',
  exp: Math.floor(Date.now() / 1000) + 300,
  iat: Math.floor(Date.now() / 1000),
  nonce: 'telegram-nonce',
  name: 'New User',
};

function createAuthRepository(overrides = {}) {
  return {
    hasPendingTelegramInvitation: async () => false,
    hasValidClaimableInvitationTokenHash: async () => false,
    hasValidPlatformAdminBootstrapTokenHash: async () => false,
    hasValidMembershipClaimTokenHash: async () => false,
    findTelegramLoginAccountState: async () => null,
    createTelegramUserForAdmission: async () => ({
      id: 'b919dd9a-12d5-4460-b0e2-f22f85ca507b',
      email: null,
      displayName: 'New User',
      platformRole: 'USER',
    }),
    touchTelegramAccount: async () => {
      throw new Error('Unexpected account touch');
    },
    ...overrides,
  };
}

function createAuthService(repository, options = {}) {
  return new AuthService(
    {
      getOrThrow(key) {
        if (key === 'WEB_APP_URL') {
          return options.webAppUrl ?? 'https://churchflow.test';
        }
        if (key === 'TELEGRAM_CLIENT_ID') {
          return 'churchflow';
        }
        if (key === 'TELEGRAM_REDIRECT_URI') {
          return options.telegramRedirectUri ?? 'https://churchflow.test/v1/auth/telegram/callback';
        }
        throw new Error('Config should not be read in admission tests');
      },
    },
    repository,
  );
}

function createSessionAuthService(repository) {
  return new AuthService(
    {
      getOrThrow(key) {
        throw new Error(`Unexpected session config key: ${key}`);
      },
    },
    repository,
  );
}

const CONTROLLER_SESSION_EXPIRES_AT = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

function createAuthController(
  cookieDomain,
  webAppUrl = 'https://stage.mychurchflow.org',
  overrides = {},
) {
  const authService = {
    logoutByToken: async () => ({ ok: true }),
    beginTelegramLogin: () => ({
      authorizationUrl: 'https://oauth.telegram.org/auth?state=state',
      state: 'state',
      codeVerifier: 'verifier',
      nonce: 'nonce',
      redirectTo: '/dashboard/stage',
    }),
    completeTelegramLogin: async (input) => ({
      user: {
        id: 'b919dd9a-12d5-4460-b0e2-f22f85ca507b',
        email: null,
        displayName: 'Stage User',
        platformRole: 'USER',
      },
      sessionToken: 'session-token',
      sessionExpiresAt: CONTROLLER_SESSION_EXPIRES_AT,
      redirectTo: input.redirectTo ?? '/dashboard/stage',
    }),
    ...overrides,
  };

  const config = {
    get(key) {
      if (key === 'COOKIE_DOMAIN') {
        return cookieDomain;
      }
      if (key === 'NODE_ENV') {
        return 'production';
      }
      return undefined;
    },
    getOrThrow(key) {
      if (key === 'WEB_APP_URL') {
        return webAppUrl;
      }
      throw new Error(`Unexpected controller config key: ${key}`);
    },
  };

  return new AuthController(authService, config);
}

class FakeResponse {
  constructor() {
    this.cookies = [];
    this.clearedCookies = [];
    this.redirectUrl = undefined;
  }

  cookie(name, value, options) {
    this.cookies.push({ name, value, options });
    return this;
  }

  clearCookie(name, options) {
    this.clearedCookies.push({ name, options });
    return this;
  }

  redirect(url) {
    this.redirectUrl = url;
    return this;
  }
}

function cookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('; ');
}

function assertSecureCookiePolicy(options, { maxAge } = {}) {
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.path, '/');
  assert.equal(Object.hasOwn(options, 'domain'), false);
  if (maxAge === undefined) {
    assert.equal(Object.hasOwn(options, 'maxAge'), false);
  } else {
    assert.equal(options.maxAge, maxAge);
  }
}

test('new session stores only the token hash, a 30-day idle window and a 180-day ceiling', async () => {
  let createdSession;
  const service = createSessionAuthService({
    createSession: async (input) => {
      createdSession = input;
      return { id: '3d3205cc-e8f4-4eb5-9b57-fcd1ffed8dd0' };
    },
  });

  const before = Date.now();
  const result = await service.createUserSession('b919dd9a-12d5-4460-b0e2-f22f85ca507b', {});

  assert.notEqual(createdSession.tokenHash, result.sessionToken);
  assert.equal(createdSession.tokenHash.length, 64);
  assert.equal(
    createdSession.tokenHash,
    createHash('sha256').update(result.sessionToken).digest('hex'),
  );
  assert.ok(createdSession.expiresAt.getTime() >= before + 30 * 24 * 60 * 60 * 1000);
  assert.ok(createdSession.absoluteExpiresAt.getTime() >= before + 180 * 24 * 60 * 60 * 1000);
  assert.equal(
    result.sessionExpiresAt.getTime(),
    createdSession.expiresAt.getTime(),
    'the cookie tracks the idle window; a ceiling-length cookie would outlive the session',
  );
});

test('new session records the device that created it', async () => {
  let createdSession;
  const service = createSessionAuthService({
    createSession: async (input) => {
      createdSession = input;
      return { id: '3d3205cc-e8f4-4eb5-9b57-fcd1ffed8dd0' };
    },
  });

  await service.createUserSession('b919dd9a-12d5-4460-b0e2-f22f85ca507b', {
    userAgent: 'ChurchFlow/1.0 (iPhone)',
    ipAddress: '203.0.113.7',
  });

  assert.equal(createdSession.userAgent, 'ChurchFlow/1.0 (iPhone)');
  assert.equal(createdSession.ipAddress, '203.0.113.7');
});

test('session token is opaque, not a JWT', async () => {
  const service = createSessionAuthService({
    createSession: async () => ({ id: '3d3205cc-e8f4-4eb5-9b57-fcd1ffed8dd0' }),
  });

  const first = await service.createUserSession('b919dd9a-12d5-4460-b0e2-f22f85ca507b', {});
  const second = await service.createUserSession('b919dd9a-12d5-4460-b0e2-f22f85ca507b', {});

  assert.equal(first.sessionToken.split('.').length, 1);
  assert.notEqual(first.sessionToken, second.sessionToken);
  assert.ok(first.sessionToken.length >= 64);
});

test('logout revokes the session behind the presented token, by hash', async () => {
  let revokedHash;
  let revokedReason;
  const service = createSessionAuthService({
    revokeSessionByTokenHash: async (tokenHash, reason) => {
      revokedHash = tokenHash;
      revokedReason = reason;
      return 1;
    },
  });

  assert.deepEqual(await service.logoutByToken('session-to-revoke'), { ok: true });
  assert.equal(revokedHash, createHash('sha256').update('session-to-revoke').digest('hex'));
  assert.notEqual(revokedHash, 'session-to-revoke');
  assert.equal(revokedReason, 'logout');
});

test('logout clears the session cookie and both legacy cookies', async () => {
  const controller = createAuthController();
  const response = new FakeResponse();

  assert.deepEqual(
    await controller.logout({ headers: { cookie: 'churchflow_session=token' } }, response),
    { ok: true },
  );
  assert.deepEqual(
    response.clearedCookies.map(({ name }) => name),
    ['churchflow_session', 'churchflow_access', 'churchflow_refresh'],
  );
});

test('logout still clears cookies when the session is already gone', async () => {
  const controller = createAuthController(undefined, 'https://stage.mychurchflow.org', {
    logoutByToken: async () => {
      throw new Error('revokeSessionByTokenHash must not be reached for an unknown token');
    },
  });
  const response = new FakeResponse();

  assert.deepEqual(await controller.logout({ headers: {} }, response), { ok: true });
  assert.equal(response.clearedCookies.length, 3);
});

test('unknown Telegram user is admitted from the organization request route', async () => {
  const service = createAuthService(createAuthRepository());

  const result = await service.resolveTelegramLoginUser(telegramClaims, '/organization-request');

  assert.equal(result.defaultRedirectTo, '/organization-request');
  assert.equal(result.user.platformRole, 'USER');
});

test('an admitted Telegram user gets the locale matching the browser language', async () => {
  const created = [];
  const repository = createAuthRepository({
    createTelegramUserForAdmission: async (input) => {
      created.push(input.locale);
      return {
        id: 'b919dd9a-12d5-4460-b0e2-f22f85ca507b',
        email: null,
        displayName: 'New User',
        platformRole: 'USER',
      };
    },
  });
  const service = createAuthService(repository);

  await service.resolveTelegramLoginUser(telegramClaims, '/organization-request', 'uk-UA,uk;q=0.9');
  await service.resolveTelegramLoginUser(telegramClaims, '/organization-request', 'ru-RU,ru;q=0.9');
  await service.resolveTelegramLoginUser(telegramClaims, '/organization-request', 'en-US,en;q=0.9');
  await service.resolveTelegramLoginUser(telegramClaims, '/organization-request');

  assert.deepEqual(created, ['uk', 'uk', 'en', 'en']);
});

test('unknown Telegram user is rejected by ordinary login', async () => {
  const service = createAuthService(createAuthRepository());

  await assert.rejects(
    service.resolveTelegramLoginUser(telegramClaims),
    /Account is not invited to ChurchFlow/,
  );
});

test('unknown Telegram user is admitted only with a valid membership claim token', async () => {
  const service = createAuthService(
    createAuthRepository({ hasValidMembershipClaimTokenHash: async () => true }),
  );
  const result = await service.resolveTelegramLoginUser(
    telegramClaims,
    '/member-claims/accept?token=valid-membership-claim-token',
  );
  assert.equal(
    result.defaultRedirectTo,
    '/member-claims/accept?token=valid-membership-claim-token',
  );
});

test('redirect normalization accepts only canonical same-origin URLs', () => {
  const service = createAuthService(createAuthRepository());

  assert.equal(service.normalizeRedirectTo('/organization-request'), '/organization-request');
  assert.equal(
    service.normalizeRedirectTo('/organization-request/status?from=login#request'),
    '/organization-request/status?from=login#request',
  );
  assert.equal(
    service.normalizeRedirectTo('/invitations/accept?token=valid-token'),
    '/invitations/accept?token=valid-token',
  );
  assert.equal(service.normalizeRedirectTo('https://churchflow.test/profile'), '/profile');
  assert.equal(service.normalizeRedirectTo('//evil.example'), undefined);
  assert.equal(service.normalizeRedirectTo('/\\evil.example'), undefined);
  assert.equal(service.normalizeRedirectTo('https://evil.example/path'), undefined);
  assert.equal(service.normalizeRedirectTo('/%5c%5cevil.example'), undefined);
  assert.equal(service.normalizeRedirectTo('/%2f%2fevil.example'), undefined);
});

test('redirect normalization is scoped to the configured stage origin', () => {
  const service = createAuthService(createAuthRepository(), {
    webAppUrl: 'https://stage.mychurchflow.org',
  });

  assert.equal(service.normalizeRedirectTo('https://stage.mychurchflow.org/profile'), '/profile');
  assert.equal(service.normalizeRedirectTo('https://mychurchflow.org/profile'), undefined);
});

test('redirect normalization is scoped to the configured production origin', () => {
  const service = createAuthService(createAuthRepository(), {
    webAppUrl: 'https://mychurchflow.org',
  });

  assert.equal(service.normalizeRedirectTo('https://mychurchflow.org/profile'), '/profile');
  assert.equal(service.normalizeRedirectTo('https://stage.mychurchflow.org/profile'), undefined);
});

for (const [label, cookieDomain] of [
  ['missing COOKIE_DOMAIN', undefined],
  ['empty COOKIE_DOMAIN', ''],
  ['blank COOKIE_DOMAIN', '   '],
]) {
  test(`auth and Telegram OAuth cookies are host-only with ${label}`, async () => {
    const controller = createAuthController(cookieDomain);
    const startResponse = new FakeResponse();
    controller.startTelegramLogin('/dashboard/stage', startResponse);

    assert.equal(startResponse.cookies.length, 4);
    for (const operation of startResponse.cookies) {
      assertSecureCookiePolicy(operation.options, { maxAge: 10 * 60 * 1000 });
    }
    for (const operation of startResponse.clearedCookies) {
      assertSecureCookiePolicy(operation.options, { maxAge: 10 * 60 * 1000 });
    }

    const callbackResponse = new FakeResponse();
    await controller.completeTelegramLogin(
      'telegram-code',
      'state',
      undefined,
      {
        headers: {
          cookie: cookieHeader({
            churchflow_telegram_state: 'state',
            churchflow_telegram_verifier: 'verifier',
            churchflow_telegram_nonce: 'nonce',
            churchflow_telegram_redirect: '/dashboard/stage',
          }),
        },
      },
      callbackResponse,
    );

    assert.deepEqual(
      callbackResponse.cookies.map(({ name }) => name),
      ['churchflow_session'],
    );
    const [sessionCookie] = callbackResponse.cookies;
    assert.equal(
      sessionCookie.options.expires.getTime(),
      CONTROLLER_SESSION_EXPIRES_AT.getTime(),
      'the login cookie must expire with the session it was issued for',
    );
    for (const operation of callbackResponse.cookies) {
      assertSecureCookiePolicy(operation.options);
      assert.ok(operation.options.expires instanceof Date);
    }
    for (const operation of callbackResponse.clearedCookies) {
      assertSecureCookiePolicy(operation.options, { maxAge: 10 * 60 * 1000 });
    }
  });
}

test('Telegram callback forwards the browser Accept-Language header', async () => {
  let forwarded;
  const controller = createAuthController(undefined, 'https://stage.mychurchflow.org', {
    completeTelegramLogin: async (input) => {
      forwarded = input.acceptLanguage;
      return {
        user: {
          id: 'b919dd9a-12d5-4460-b0e2-f22f85ca507b',
          email: null,
          displayName: 'Stage User',
          platformRole: 'USER',
        },
        sessionToken: 'session-token',
        sessionExpiresAt: CONTROLLER_SESSION_EXPIRES_AT,
        redirectTo: '/dashboard/stage',
      };
    },
  });

  await controller.completeTelegramLogin(
    'telegram-code',
    'state',
    undefined,
    {
      headers: {
        'accept-language': 'uk-UA,uk;q=0.9',
        cookie: cookieHeader({
          churchflow_telegram_state: 'state',
          churchflow_telegram_verifier: 'verifier',
          churchflow_telegram_nonce: 'nonce',
        }),
      },
    },
    new FakeResponse(),
  );

  assert.equal(forwarded, 'uk-UA,uk;q=0.9');
});

test('Telegram callback redirects to the configured stage web origin', async () => {
  const controller = createAuthController(undefined, 'https://stage.mychurchflow.org');
  const response = new FakeResponse();

  await controller.completeTelegramLogin(
    'telegram-code',
    'state',
    undefined,
    {
      headers: {
        cookie: cookieHeader({
          churchflow_telegram_state: 'state',
          churchflow_telegram_verifier: 'verifier',
          churchflow_telegram_nonce: 'nonce',
          churchflow_telegram_redirect: '/dashboard/stage',
        }),
      },
    },
    response,
  );

  assert.equal(response.redirectUrl, 'https://stage.mychurchflow.org/dashboard/stage');
});

test('Telegram callback redirects to the configured production web origin', async () => {
  const controller = createAuthController(undefined, 'https://mychurchflow.org');
  const response = new FakeResponse();

  await controller.completeTelegramLogin(
    'telegram-code',
    'state',
    undefined,
    {
      headers: {
        cookie: cookieHeader({
          churchflow_telegram_state: 'state',
          churchflow_telegram_verifier: 'verifier',
          churchflow_telegram_nonce: 'nonce',
          churchflow_telegram_redirect: '/dashboard/prod',
        }),
      },
    },
    response,
  );

  assert.equal(response.redirectUrl, 'https://mychurchflow.org/dashboard/prod');
});

test('Telegram authorization starts with state, PKCE and nonce', () => {
  const service = createAuthService(createAuthRepository());
  const result = service.beginTelegramLogin({ redirectTo: '/organization-request' });
  const authorizationUrl = new URL(result.authorizationUrl);

  assert.equal(authorizationUrl.searchParams.get('state'), result.state);
  assert.equal(authorizationUrl.searchParams.get('nonce'), result.nonce);
  assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(result.redirectTo, '/organization-request');
});

test('Telegram ID token requires matching nonce and reasonable issued-at time', async () => {
  const service = createAuthService(createAuthRepository());
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  service.findTelegramJwk = async () => publicKey.export({ format: 'jwk' });
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const makeToken = (claims) => {
    const header = encode({ alg: 'RS256', typ: 'JWT', kid: 'test-key' });
    const payload = encode(claims);
    const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey);
    return `${header}.${payload}.${signature.toString('base64url')}`;
  };
  const now = Math.floor(Date.now() / 1000);
  const validClaims = {
    ...telegramClaims,
    exp: now + 300,
    iat: now,
    nonce: 'expected-nonce',
  };

  const result = await service.verifyTelegramIdToken(makeToken(validClaims), 'expected-nonce');
  assert.equal(result.sub, telegramClaims.sub);
  await assert.rejects(
    service.verifyTelegramIdToken(makeToken(validClaims), 'different-nonce'),
    /Invalid Telegram ID token claims/,
  );
  await assert.rejects(
    service.verifyTelegramIdToken(
      makeToken({ ...validClaims, iat: now + 10 * 60 }),
      'expected-nonce',
    ),
    /Invalid Telegram ID token claims/,
  );
});

test('organization slug generation supports Ukrainian names and safe fallback', () => {
  assert.equal(
    generateOrganizationSlug('Вінницька Біблійна Церква', 'request-id'),
    'vinnytska-bibliina-tserkva',
  );
  assert.equal(generateOrganizationSlug('Церква Надії', 'request-id'), 'tserkva-nadii');
  assert.equal(generateOrganizationSlug('!!!', 'abc-123'), 'organization-abc123');
  assert.ok(generateOrganizationSlug('Церква '.repeat(30), 'request-id').length <= 80);
});

test('returning requester without membership is redirected to request status', async () => {
  const user = {
    id: 'b919dd9a-12d5-4460-b0e2-f22f85ca507b',
    email: null,
    displayName: 'Requester',
    platformRole: 'USER',
  };
  const service = createAuthService(
    createAuthRepository({
      findTelegramLoginAccountState: async () => ({
        accountId: 'telegram-account',
        user,
        isActive: true,
        hasActiveMembership: false,
        hasOrganizationRequest: true,
        hasPendingOrganizationRequest: true,
        hasMembershipClaim: false,
        isPlatformAdmin: false,
      }),
      touchTelegramAccount: async () => user,
    }),
  );

  const result = await service.resolveTelegramLoginUser(telegramClaims);

  assert.equal(result.defaultRedirectTo, '/organization-request/status');
});

test('a requester cannot create a second pending organization request', async () => {
  const service = new OrganizationRequestsService(
    {
      expireStaleAndFindPending: async () => ({ id: 'pending-request' }),
    },
    {},
    {},
  );

  await assert.rejects(
    service.create(
      { organizationName: 'Grace Church', contactName: 'Requester' },
      'b919dd9a-12d5-4460-b0e2-f22f85ca507b',
    ),
    /already have a pending organization request/,
  );
});

test('an expired pending request no longer blocks a new request', async () => {
  let receivedStaleBefore;
  const service = new OrganizationRequestsService(
    {
      expireStaleAndFindPending: async (_userId, staleBefore) => {
        receivedStaleBefore = staleBefore;
        return null;
      },
      create: async () => ({
        id: 'new-request',
        organizationName: 'Grace Church',
        contactName: 'Requester',
        contactEmail: null,
        contactPhone: null,
        message: null,
        requestedBy: { accounts: [{ providerAccountId: 'telegram-user-1' }] },
      }),
    },
    {
      platformAdminEmail: 'admin@churchflow.test',
      sendOrganizationRequestAdminEmail: async () => undefined,
    },
    undefined,
    undefined,
    createUserLocaleService(),
  );

  const result = await service.create(
    { organizationName: 'Grace Church', contactName: 'Requester' },
    'b919dd9a-12d5-4460-b0e2-f22f85ca507b',
  );

  assert.equal(result.id, 'new-request');
  assert.ok(receivedStaleBefore instanceof Date);
  assert.ok(receivedStaleBefore.getTime() <= Date.now() - 29 * 24 * 60 * 60 * 1000);
});

test('email failure does not fail a committed organization request', async () => {
  const service = new OrganizationRequestsService(
    {
      expireStaleAndFindPending: async () => null,
      create: async () => ({
        id: 'f22eb5f1-866b-4b93-955b-25c2b5c41ac1',
        organizationName: 'Grace Church',
        contactName: 'Requester',
        contactEmail: 'requester@example.com',
        contactPhone: null,
        message: null,
        requestedBy: { accounts: [{ providerAccountId: 'telegram-user-1' }] },
      }),
    },
    {
      platformAdminEmail: 'admin@churchflow.test',
      sendOrganizationRequestAdminEmail: async () => {
        throw new Error('Email provider unavailable');
      },
    },
    undefined,
    undefined,
    createUserLocaleService(),
  );

  const result = await service.create(
    {
      organizationName: 'Grace Church',
      contactName: 'Requester',
      contactEmail: 'requester@example.com',
    },
    'b919dd9a-12d5-4460-b0e2-f22f85ca507b',
  );

  assert.equal(result.notificationSent, false);
});

test('expired request resubmission returns a new pending request and sends admin notification', async () => {
  let notification;
  const service = new OrganizationRequestsService(
    {
      resubmitExpired: async () => ({
        id: 'resubmitted-request',
        organizationName: 'Grace Church',
        contactName: 'Requester',
        contactEmail: 'requester@example.com',
        contactPhone: null,
        message: 'Please review again',
        createdAt: new Date('2026-07-01T20:00:00.000Z'),
        requestedBy: { accounts: [{ providerAccountId: 'telegram-user-1' }] },
      }),
    },
    {
      platformAdminEmail: 'admin@churchflow.test',
      sendOrganizationRequestAdminEmail: async (input) => {
        notification = input;
      },
    },
    undefined,
    undefined,
    createUserLocaleService(),
  );

  const result = await service.resubmit('expired-request', 'requester');

  assert.equal(result.request.id, 'resubmitted-request');
  assert.equal(result.request.status, 'PENDING');
  assert.equal(result.request.createdAt, '2026-07-01T20:00:00.000Z');
  assert.equal(result.notificationSent, true);
  assert.equal(notification.requestId, 'resubmitted-request');
});

test('claimable invitation cannot grant an elevated role', async () => {
  const service = new InvitationsService(
    {
      findActiveOrganization: async () => ({ id: 'organization', name: 'Grace Church' }),
      findActiveMembership: async () => ({ role: 'OWNER' }),
    },
    {},
    {},
    createUserLocaleService(),
  );

  await assert.rejects(
    service.createForOrganization(
      '5d39df8a-3180-4311-bc25-4d858f6d663b',
      { mode: 'claimable_link', role: 'ADMIN' },
      'b919dd9a-12d5-4460-b0e2-f22f85ca507b',
    ),
    /Claimable links are allowed only for member and viewer roles/,
  );
});

test('last owner downgrade is exposed as a conflict', async () => {
  const service = new MembershipsService(
    {
      updateRole: async () => {
        throw new Error('LAST_OWNER');
      },
    },
    {},
  );

  await assert.rejects(
    service.updateRole(
      '5d39df8a-3180-4311-bc25-4d858f6d663b',
      '3b0445ca-043e-4818-b7fd-154729897629',
      'MEMBER',
      'b919dd9a-12d5-4460-b0e2-f22f85ca507b',
    ),
    /Cannot downgrade the last organization owner/,
  );
});

test('non-owner cannot change member roles', async () => {
  const service = new MembershipsService(
    {
      updateRole: async () => {
        throw new Error('ACTOR_NOT_OWNER');
      },
    },
    {},
  );

  await assert.rejects(
    service.updateRole('organization', 'membership', 'ADMIN', 'actor'),
    /Only organization owners can change member roles/,
  );
});

test('owner can promote an active member', async () => {
  const service = new MembershipsService(
    {
      updateRole: async (input) => ({ id: input.membershipId, role: input.role }),
    },
    {},
  );

  const result = await service.updateRole('organization', 'membership', 'ADMIN', 'owner');

  assert.equal(result.role, 'ADMIN');
});

test('expired invitation cannot be accepted', async () => {
  const service = new InvitationsService(
    {
      findByTokenHash: async () => ({
        id: 'invitation',
        organizationId: 'organization',
        email: null,
        mode: 'claimable_link',
        targetProvider: null,
        targetProviderAccountId: null,
        targetDisplay: null,
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1),
        acceptedAt: null,
        revokedAt: null,
        organization: { id: 'organization', name: 'Grace Church' },
      }),
    },
    {},
    {},
    createUserLocaleService(),
  );

  await assert.rejects(service.accept('raw-invitation-token', 'user'), /Invitation has expired/);
});

test('targeted invitation requires the matching Telegram account', async () => {
  const service = new InvitationsService(
    {
      findByTokenHash: async () => ({
        id: 'invitation',
        organizationId: 'organization',
        email: null,
        mode: 'targeted_telegram',
        targetProvider: 'telegram',
        targetProviderAccountId: 'expected-account',
        targetDisplay: null,
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        acceptedAt: null,
        revokedAt: null,
        organization: { id: 'organization', name: 'Grace Church' },
      }),
      findUserForInvitation: async () => ({
        id: 'user',
        deletedAt: null,
        accounts: [{ provider: 'telegram', providerAccountId: 'different-account' }],
      }),
    },
    {},
    {},
    createUserLocaleService(),
  );

  await assert.rejects(
    service.accept('raw-invitation-token', 'user'),
    /Authenticated provider account must match invitation target/,
  );
});

test('invitation email failure still returns the generated link', async () => {
  const service = new InvitationsService(
    {
      findActiveOrganization: async () => ({ id: 'organization', name: 'Grace Church' }),
      findActiveMembership: async () => ({ role: 'OWNER' }),
      createOrRefreshPending: async (input) => ({ id: 'invitation', ...input }),
    },
    {
      buildOrganizationInvitationUrl: (token) => `https://churchflow.test/invitations/${token}`,
      sendOrganizationInvitationEmail: async () => {
        throw new Error('Email provider unavailable');
      },
    },
    { record: async () => undefined },
    createUserLocaleService(),
  );

  const result = await service.createForOrganization(
    '5d39df8a-3180-4311-bc25-4d858f6d663b',
    { mode: 'claimable_link', role: 'MEMBER', email: 'member@example.com' },
    'b919dd9a-12d5-4460-b0e2-f22f85ca507b',
  );

  assert.equal(result.emailSent, false);
  assert.match(result.acceptUrl, /^https:\/\/churchflow\.test\/invitations\//);
});
