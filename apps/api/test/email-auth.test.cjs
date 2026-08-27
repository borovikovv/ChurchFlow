const assert = require('node:assert/strict');
const test = require('node:test');
const { createHash } = require('node:crypto');
const { EmailAuthService } = require('../dist/modules/auth/email/email-auth.service.js');
const {
  EMAIL_LOGIN_REQUESTS_PER_WINDOW,
} = require('../dist/modules/auth/email/email-login-policy.js');
const {
  generateEmailLoginCode,
  hashEmailLoginCode,
  verifyEmailLoginCode,
} = require('../dist/common/auth/email-login-code.js');

const WEB_APP_URL = 'https://churchflow.test';
const USER_ID = 'a2b0b9f1-1f0e-4a2b-8a7d-2f6c9b1d4e5a';
const EMAIL = 'member@example.com';

function memberState(overrides = {}) {
  return {
    user: { id: USER_ID, email: EMAIL, displayName: 'Member', platformRole: 'USER' },
    isEmailVerified: true,
    hasActiveMembership: true,
    hasOrganizationRequest: false,
    hasMembershipClaim: false,
    isPlatformAdmin: false,
    ...overrides,
  };
}

function createService(overrides = {}) {
  const sent = [];
  const issued = [];
  const audited = [];
  const touched = [];
  const confirmed = [];

  const repository = {
    findVerificationCandidate: async () => null,
    countRecentTokens: async () => 0,
    findLoginAccountState: async () => memberState(),
    createAdmittedEmailUser: async () => {
      throw new Error('createAdmittedEmailUser should not be reached');
    },
    touchEmailAccount: async (userId) => {
      touched.push(userId);
    },
    confirmEmailIdentity: async (userId, email) => {
      confirmed.push({ userId, email });
    },
    issueToken: async (input) => {
      issued.push(input);
    },
    consumeSignInTokenByHash: async () => null,
    findLiveSignInToken: async () => null,
    recordFailedCodeAttempt: async () => {},
    consumeSignInTokenById: async () => true,
    consumeVerificationToken: async () => null,
    ...overrides.repository,
  };

  const authRepository = {
    hasValidClaimableInvitationTokenHash: async () => false,
    hasValidPlatformAdminBootstrapTokenHash: async () => false,
    hasValidMembershipClaimTokenHash: async () => false,
    ...overrides.authRepository,
  };

  const service = new EmailAuthService(
    {
      getOrThrow(key) {
        if (key === 'WEB_APP_URL') {
          return WEB_APP_URL;
        }
        throw new Error(`Unexpected config key: ${key}`);
      },
    },
    repository,
    authRepository,
    {
      createUserSession: async () => ({
        sessionToken: 'session-token',
        sessionExpiresAt: new Date('2026-09-25T00:00:00.000Z'),
      }),
    },
    {
      sendEmailSignInEmail: async (input) => {
        sent.push(input);
      },
      sendEmailVerificationEmail: async (input) => {
        sent.push(input);
      },
    },
    {
      forUser: async () => 'en',
      forEmail: async () => 'en',
    },
    {
      record: async (entry) => {
        audited.push(entry);
      },
    },
  );

  return { service, sent, issued, audited, touched, confirmed };
}

test('a six-digit code survives its own hashing and nothing else does', async () => {
  const code = generateEmailLoginCode();
  assert.match(code, /^\d{6}$/);

  const hash = await hashEmailLoginCode(code);
  assert.notEqual(hash, code);
  assert.equal(hash.includes(code), false);
  assert.equal(await verifyEmailLoginCode(code, hash), true);
  assert.equal(await verifyEmailLoginCode('000000', hash), false);
  assert.equal(await verifyEmailLoginCode(code, 'not-a-hash'), false);
  assert.equal(await verifyEmailLoginCode(code, 'aabb:ccdd'), false);
});

test('the same code hashed twice does not produce the same stored value', async () => {
  const first = await hashEmailLoginCode('123456');
  const second = await hashEmailLoginCode('123456');

  assert.notEqual(first, second);
  assert.equal(await verifyEmailLoginCode('123456', first), true);
  assert.equal(await verifyEmailLoginCode('123456', second), true);
});

test('a sign-in request for an unknown address issues nothing and reveals nothing', async () => {
  const { service, sent, issued } = createService({
    repository: { findLoginAccountState: async () => null },
  });

  await service.requestSignIn({ email: 'stranger@example.com', client: {} });

  assert.deepEqual(issued, []);
  assert.deepEqual(sent, []);
});

test('an address the account never confirmed is still sent the link that confirms it', async () => {
  const { service, sent, issued } = createService({
    repository: { findLoginAccountState: async () => memberState({ isEmailVerified: false }) },
  });

  await service.requestSignIn({ email: EMAIL, client: {} });

  assert.equal(issued.length, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].email, EMAIL);
});

test('coming back with the link confirms the address it was sent to', async () => {
  const { service, audited, touched, confirmed } = createService({
    repository: {
      consumeSignInTokenByHash: async () => ({ email: EMAIL, redirectTo: null }),
      findLoginAccountState: async () => memberState({ isEmailVerified: false }),
    },
  });

  await service.completeSignInWithToken('live-token', {});

  assert.deepEqual(confirmed, [{ userId: USER_ID, email: EMAIL }]);
  assert.deepEqual(touched, []);
  assert.deepEqual(
    audited.map((entry) => entry.metadata),
    [{ event: 'email_verified' }, { provider: 'email' }],
  );
});

test('an address that was already confirmed is not confirmed a second time', async () => {
  const { service, touched, confirmed } = createService({
    repository: { consumeSignInTokenByHash: async () => ({ email: EMAIL, redirectTo: null }) },
  });

  await service.completeSignInWithToken('live-token', {});

  assert.deepEqual(confirmed, []);
  assert.deepEqual(touched, [USER_ID]);
});

test('a confirmed member is sent a link and a code that are stored only as hashes', async () => {
  const { service, sent, issued } = createService();

  await service.requestSignIn({ email: EMAIL, client: {} });

  assert.equal(issued.length, 1);
  assert.equal(sent.length, 1);

  const [token] = issued;
  const [mail] = sent;
  assert.equal(token.purpose, 'sign_in');
  assert.equal(token.email, EMAIL);
  assert.equal(token.tokenHash, createHash('sha256').update(mail.token).digest('hex'));
  assert.notEqual(token.codeHash, mail.code);
  assert.equal(await verifyEmailLoginCode(mail.code, token.codeHash), true);
});

test('the address is normalised before it is looked up or stored', async () => {
  const seen = [];
  const { service, issued } = createService({
    repository: {
      findLoginAccountState: async (email) => {
        seen.push(email);
        return memberState();
      },
    },
  });

  await service.requestSignIn({ email: '  Member@Example.COM ', client: {} });

  assert.deepEqual(seen, [EMAIL]);
  assert.equal(issued[0].email, EMAIL);
});

test('a redirect to another origin is dropped rather than carried through the email', async () => {
  const { service, issued } = createService();

  await service.requestSignIn({
    email: EMAIL,
    redirectTo: 'https://evil.example/steal',
    client: {},
  });

  assert.equal(issued[0].redirectTo, undefined);
});

test('an unclaimed invitation link admits an address that has no account yet', async () => {
  const created = [];
  const { service, issued } = createService({
    repository: {
      findLoginAccountState: async () => (created.length > 0 ? memberState() : null),
      createAdmittedEmailUser: async (input) => {
        created.push(input);
        return { id: USER_ID, email: input.email, displayName: null, platformRole: 'USER' };
      },
    },
    authRepository: { hasValidClaimableInvitationTokenHash: async () => true },
  });

  await service.requestSignIn({
    email: EMAIL,
    redirectTo: '/invitations/accept?token=live-invitation',
    client: {},
  });

  assert.equal(issued.length, 1);
  assert.equal(issued[0].redirectTo, '/invitations/accept?token=live-invitation');
});

test('the page that asks for an organization admits an address nobody has invited', async () => {
  const created = [];
  const { service, issued, sent } = createService({
    repository: {
      findLoginAccountState: async () => (created.length > 0 ? memberState() : null),
      createAdmittedEmailUser: async (input) => {
        created.push(input);
        return { id: USER_ID, email: input.email, displayName: null, platformRole: 'USER' };
      },
    },
  });

  await service.requestSignIn({
    email: 'stranger@example.com',
    redirectTo: '/organization-request',
    client: {},
  });

  assert.equal(issued.length, 1);
  assert.equal(sent.length, 1);
  assert.equal(issued[0].redirectTo, '/organization-request');
});

test('a page that carries no token and no onboarding admits nobody', async () => {
  const { service, issued, sent } = createService({
    repository: { findLoginAccountState: async () => null },
  });

  await service.requestSignIn({
    email: 'stranger@example.com',
    redirectTo: '/dashboard/org-1',
    client: {},
  });

  assert.deepEqual(issued, []);
  assert.deepEqual(sent, []);
});

test('a link that has already been used cannot be used again', async () => {
  const { service } = createService({
    repository: { consumeSignInTokenByHash: async () => null },
  });

  await assert.rejects(
    service.completeSignInWithToken('spent-token', {}),
    /This sign-in link is no longer valid/,
  );
});

test('a link stops working when the account loses its standing before the link is opened', async () => {
  const { service } = createService({
    repository: {
      consumeSignInTokenByHash: async () => ({ email: EMAIL, redirectTo: null }),
      findLoginAccountState: async () =>
        memberState({ hasActiveMembership: false, hasOrganizationRequest: false }),
    },
  });

  await assert.rejects(
    service.completeSignInWithToken('live-token', {}),
    /This account cannot sign in with email/,
  );
});

test('opening the link signs the member in and records how they got there', async () => {
  const { service, audited } = createService({
    repository: {
      consumeSignInTokenByHash: async () => ({ email: EMAIL, redirectTo: '/dashboard/org-1' }),
    },
  });

  const result = await service.completeSignInWithToken('live-token', {});

  assert.equal(result.sessionToken, 'session-token');
  assert.equal(result.redirectTo, '/dashboard/org-1');
  assert.deepEqual(audited, [
    {
      actorUserId: USER_ID,
      action: 'LOGIN',
      entityType: 'User',
      entityId: USER_ID,
      metadata: { provider: 'email' },
    },
  ]);
});

test('a platform admin without membership lands on the admin area, not a requested page', async () => {
  const { service } = createService({
    repository: {
      consumeSignInTokenByHash: async () => ({ email: EMAIL, redirectTo: '/dashboard/org-1' }),
      findLoginAccountState: async () =>
        memberState({ hasActiveMembership: false, isPlatformAdmin: true }),
    },
  });

  const result = await service.completeSignInWithToken('live-token', {});

  assert.equal(result.redirectTo, '/admin/organizations');
});

test('a wrong code is counted against the token it was guessed at', async () => {
  const attempts = [];
  const codeHash = await hashEmailLoginCode('123456');
  const { service } = createService({
    repository: {
      findLiveSignInToken: async () => ({ id: 'token-1', codeHash, redirectTo: null }),
      recordFailedCodeAttempt: async (tokenId) => {
        attempts.push(tokenId);
      },
    },
  });

  await assert.rejects(
    service.completeSignInWithCode({ email: EMAIL, code: '999999' }, {}),
    /This sign-in code is no longer valid/,
  );

  // Whether that attempt was the last one the token had is decided by the statement that
  // records it, so that concurrent guesses cannot each read the same stale count.
  assert.deepEqual(attempts, ['token-1']);
});

test('a correct code signs in only while the token is still there to consume', async () => {
  const codeHash = await hashEmailLoginCode('123456');
  const { service } = createService({
    repository: {
      findLiveSignInToken: async () => ({ id: 'token-1', codeHash, redirectTo: null }),
      consumeSignInTokenById: async () => false,
    },
  });

  await assert.rejects(
    service.completeSignInWithCode({ email: EMAIL, code: '123456' }, {}),
    /This sign-in code is no longer valid/,
  );
});

test('a correct code produces the same session a link would have', async () => {
  const codeHash = await hashEmailLoginCode('123456');
  const { service } = createService({
    repository: {
      findLiveSignInToken: async () => ({ id: 'token-1', codeHash, redirectTo: null }),
    },
  });

  const result = await service.completeSignInWithCode({ email: EMAIL, code: '123456' }, {});

  assert.equal(result.sessionToken, 'session-token');
  assert.equal(result.redirectTo, '/');
});

test('a verification link only confirms an address the account still holds', async () => {
  const { service } = createService({
    repository: { consumeVerificationToken: async () => null },
  });

  await assert.rejects(
    service.completeEmailVerification('stale-token'),
    /This verification link is no longer valid/,
  );
});

test('confirming an address is recorded and returns the profile', async () => {
  const { service, audited } = createService({
    repository: {
      consumeVerificationToken: async () => ({ userId: USER_ID, email: EMAIL }),
    },
  });

  const result = await service.completeEmailVerification('live-token');

  assert.equal(result.redirectTo, '/profile');
  assert.equal(audited[0].metadata.event, 'email_verified');
});

test('an address that is already confirmed is not sent another verification link', async () => {
  const { service, sent } = createService({
    repository: {
      findVerificationCandidate: async () => ({
        id: USER_ID,
        email: EMAIL,
        emailVerified: new Date('2026-08-01T00:00:00.000Z'),
      }),
    },
  });

  await assert.rejects(service.requestEmailVerification(USER_ID, {}), /already verified/);
  assert.deepEqual(sent, []);
});

test('a verification link is issued without a code, because the caller is already signed in', async () => {
  const { service, issued, sent } = createService({
    repository: {
      findVerificationCandidate: async () => ({ id: USER_ID, email: EMAIL, emailVerified: null }),
    },
  });

  await service.requestEmailVerification(USER_ID, {});

  assert.equal(issued.length, 1);
  assert.equal(issued[0].purpose, 'verify_email');
  assert.equal(issued[0].codeHash, undefined);
  assert.equal(sent.length, 1);
});

test('an address that has already been sent its share of links is quietly left alone', async () => {
  const { service, sent, issued } = createService({
    repository: { countRecentTokens: async () => EMAIL_LOGIN_REQUESTS_PER_WINDOW },
  });

  // Silent, not refused: saying "too many" would say the address was worth counting.
  await service.requestSignIn({ email: EMAIL, client: {} });

  assert.deepEqual(issued, []);
  assert.deepEqual(sent, []);
});

test('the request limit counts links for one address, not callers', async () => {
  const counted = [];
  const { service } = createService({
    repository: {
      countRecentTokens: async (email, purpose, since) => {
        counted.push({ email, purpose, since });
        return 0;
      },
    },
  });

  await service.requestSignIn({ email: '  SOFI@Example.com ', client: {} });

  assert.equal(counted.length, 1);
  assert.equal(counted[0].email, 'sofi@example.com');
  assert.equal(counted[0].purpose, 'sign_in');
});

test('confirmation emails are limited too, and say so, because the caller is known', async () => {
  const { service, sent } = createService({
    repository: {
      findVerificationCandidate: async () => ({ id: USER_ID, email: EMAIL, emailVerified: null }),
      countRecentTokens: async () => EMAIL_LOGIN_REQUESTS_PER_WINDOW,
    },
  });

  await assert.rejects(service.requestEmailVerification(USER_ID, {}), /Too many confirmation/);
  assert.deepEqual(sent, []);
});
