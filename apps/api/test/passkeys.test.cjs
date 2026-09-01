const assert = require('node:assert/strict');
const test = require('node:test');
const { createHash } = require('node:crypto');
const { PasskeysService } = require('../dist/modules/auth/passkeys/passkeys.service.js');
const {
  isReplayedSignCount,
  toKnownTransports,
} = require('../dist/modules/auth/passkeys/passkey-policy.js');
const {
  hasStandingToSignIn,
  resolveLoginRedirect,
} = require('../dist/modules/auth/login-state.js');

const WEB_APP_URL = 'https://churchflow.test';
const USER_ID = 'a2b0b9f1-1f0e-4a2b-8a7d-2f6c9b1d4e5a';
const PASSKEY_ID = 'c7d4f4a2-58f1-4b8b-9a53-0c2f1b4a7e33';

function loginState(overrides = {}) {
  return {
    user: { id: USER_ID, email: 'member@example.com', displayName: 'Member', platformRole: 'USER' },
    isEmailVerified: true,
    hasActiveMembership: true,
    hasOrganizationRequest: false,
    hasMembershipClaim: false,
    isPlatformAdmin: false,
    ...overrides,
  };
}

function createService(overrides = {}) {
  const challenges = [];
  const audited = [];

  const repository = {
    findLoginState: async () => loginState(),
    listCredentialsForUser: async () => [],
    listForUser: async () => [],
    createChallenge: async (input) => {
      challenges.push(input);
    },
    consumeChallenge: async () => true,
    findCredential: async () => null,
    createPasskey: async () => ({}),
    recordAuthentication: async () => {},
    rename: async () => null,
    deleteUnlessLastSignInMethod: async () => 'deleted',
    ...overrides.repository,
  };

  const service = new PasskeysService(
    {
      get: () => undefined,
      getOrThrow(key) {
        if (key === 'WEB_APP_URL') {
          return WEB_APP_URL;
        }
        throw new Error(`Unexpected config key: ${key}`);
      },
    },
    repository,
    {
      hasValidClaimableInvitationTokenHash: async () => false,
      hasValidPlatformAdminBootstrapTokenHash: async () => false,
      hasValidMembershipClaimTokenHash: async () => false,
      ...overrides.authRepository,
    },
    {
      createUserSession: async () => ({
        sessionToken: 'session-token',
        sessionExpiresAt: new Date('2026-09-25T00:00:00.000Z'),
      }),
    },
    {
      record: async (entry) => {
        audited.push(entry);
      },
    },
  );

  return { service, challenges, audited };
}

test('a transport the build has never heard of is dropped rather than trusted', () => {
  assert.deepEqual(toKnownTransports(['usb', 'nfc']), ['usb', 'nfc']);
  assert.deepEqual(toKnownTransports(['internal', 'telepathy']), ['internal']);
  assert.deepEqual(toKnownTransports([]), []);
  assert.deepEqual(toKnownTransports(['', 'USB']), []);
});

test('a counter that fails to move forward is treated as a cloned credential', () => {
  assert.equal(isReplayedSignCount(5, 6), false);
  assert.equal(isReplayedSignCount(5, 5), true);
  assert.equal(isReplayedSignCount(5, 4), true);
});

test('an authenticator that never counts is not mistaken for a clone', () => {
  assert.equal(isReplayedSignCount(0, 0), false);
  assert.equal(isReplayedSignCount(0, 1), false);
});

test('registration options exclude the credentials this account already holds', async () => {
  const { service } = createService({
    repository: {
      listCredentialsForUser: async () => [
        { credentialId: 'already-here', transports: ['internal', 'telepathy'] },
      ],
    },
  });

  const options = await service.startRegistration(USER_ID);

  assert.equal(options.rp.id, 'churchflow.test');
  assert.equal(options.rp.name, 'ChurchFlow');
  assert.equal(options.authenticatorSelection.residentKey, 'required');
  assert.deepEqual(options.excludeCredentials, [
    { id: 'already-here', type: 'public-key', transports: ['internal'] },
  ]);
});

test('the challenge is kept only as a hash, and scoped to the user who asked for it', async () => {
  const { service, challenges } = createService();

  const options = await service.startRegistration(USER_ID);

  assert.equal(challenges.length, 1);
  const [challenge] = challenges;
  assert.equal(challenge.type, 'registration');
  assert.equal(challenge.userId, USER_ID);
  assert.equal(
    challenge.challengeHash,
    createHash('sha256').update(options.challenge).digest('hex'),
  );
  assert.equal(challenge.challengeHash.includes(options.challenge), false);
});

test('a sign-in challenge belongs to nobody in particular, because nobody has been named yet', async () => {
  const { service, challenges } = createService();

  const options = await service.startAuthentication();

  assert.equal(options.rpId, 'churchflow.test');
  assert.equal(challenges[0].type, 'authentication');
  assert.equal(challenges[0].userId, undefined);
  assert.equal(
    challenges[0].challengeHash,
    createHash('sha256').update(options.challenge).digest('hex'),
  );
});

test('two challenges issued in a row are not the same challenge', async () => {
  const { service, challenges } = createService();

  await service.startAuthentication();
  await service.startAuthentication();

  assert.notEqual(challenges[0].challengeHash, challenges[1].challengeHash);
});

test('a credential the account does not know is refused before any verification runs', async () => {
  const { service } = createService({ repository: { findCredential: async () => null } });

  await assert.rejects(
    service.finishAuthentication({ response: { id: 'never-seen' }, client: {} }),
    /This passkey could not be verified/,
  );
});

test('the last way back into an account cannot be removed', async () => {
  const { service, audited } = createService({
    repository: { deleteUnlessLastSignInMethod: async () => 'last_sign_in_method' },
  });

  await assert.rejects(
    service.remove(USER_ID, PASSKEY_ID),
    /Add another sign-in method before removing the last one/,
  );
  assert.deepEqual(audited, []);
});

test('a passkey is removed once another sign-in method remains', async () => {
  const { service, audited } = createService();

  assert.deepEqual(await service.remove(USER_ID, PASSKEY_ID), { ok: true });
  assert.equal(audited[0].metadata.event, 'passkey_removed');
});

// Two removals racing must not be able to take the last method between them, so counting and
// deleting is one call the repository answers atomically rather than two the service sequences.
test('counting the remaining methods is not a step the service can be raced through', async () => {
  const calls = [];
  const { service } = createService({
    repository: {
      deleteUnlessLastSignInMethod: async (id, userId) => {
        calls.push({ id, userId });
        return 'deleted';
      },
    },
  });

  await service.remove(USER_ID, PASSKEY_ID);

  assert.deepEqual(calls, [{ id: PASSKEY_ID, userId: USER_ID }]);
});

test('removing somebody else passkey reads as not found rather than refused', async () => {
  const { service } = createService({
    repository: { deleteUnlessLastSignInMethod: async () => 'not_found' },
  });

  await assert.rejects(service.remove(USER_ID, PASSKEY_ID), /Passkey was not found/);
});

test('renaming somebody else passkey reads as not found rather than refused', async () => {
  const { service } = createService({ repository: { rename: async () => null } });

  await assert.rejects(service.rename(USER_ID, PASSKEY_ID, 'Laptop'), /Passkey was not found/);
});

test('an account with no tie to an organization has nothing to sign in to', () => {
  assert.equal(hasStandingToSignIn(loginState()), true);
  assert.equal(hasStandingToSignIn(loginState({ hasActiveMembership: false })), false);
  assert.equal(
    hasStandingToSignIn(loginState({ hasActiveMembership: false, isPlatformAdmin: true })),
    true,
  );
  assert.equal(
    hasStandingToSignIn(loginState({ hasActiveMembership: false, hasOrganizationRequest: true })),
    true,
  );
  assert.equal(
    hasStandingToSignIn(loginState({ hasActiveMembership: false, hasMembershipClaim: true })),
    true,
  );
});

test('a requested page is honoured for members, and only for members', () => {
  assert.equal(resolveLoginRedirect(loginState(), '/dashboard/org-1'), '/dashboard/org-1');
  assert.equal(
    resolveLoginRedirect(loginState({ hasActiveMembership: false }), '/dashboard/org-1'),
    '/',
  );
});

test('a link that carried its own credential may send the caller back where it came from', () => {
  const state = loginState({ hasActiveMembership: false });

  assert.equal(
    resolveLoginRedirect(state, '/invitations/accept?token=live', true),
    '/invitations/accept?token=live',
  );
});

test('everyone else lands where their account actually stands', () => {
  assert.equal(
    resolveLoginRedirect(loginState({ hasActiveMembership: false, isPlatformAdmin: true }), null),
    '/admin/organizations',
  );
  assert.equal(
    resolveLoginRedirect(
      loginState({ hasActiveMembership: false, hasOrganizationRequest: true }),
      null,
    ),
    '/organization-request/status',
  );
  assert.equal(
    resolveLoginRedirect(
      loginState({ hasActiveMembership: false, hasMembershipClaim: true }),
      null,
    ),
    '/member-claims/status',
  );
  assert.equal(resolveLoginRedirect(loginState(), null), '/');
});
