const assert = require('node:assert/strict');
const test = require('node:test');
const { InvitationsService } = require('../dist/modules/invitations/invitations.service.js');

const ORGANIZATION_ID = '5d39df8a-3180-4311-bc25-4d858f6d663b';
const USER_ID = 'b919dd9a-12d5-4460-b0e2-f22f85ca507b';
const VERIFIED_AT = new Date('2026-08-01T00:00:00.000Z');

function invitation(overrides = {}) {
  return {
    id: 'invitation',
    organizationId: ORGANIZATION_ID,
    email: 'member@example.com',
    mode: 'claimable_link',
    targetProvider: null,
    targetProviderAccountId: null,
    targetDisplay: null,
    role: 'MEMBER',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
    revokedAt: null,
    organization: { id: ORGANIZATION_ID, name: 'Grace Church' },
    ...overrides,
  };
}

function createService({ invitation: pending, user }) {
  const accepted = [];

  const service = new InvitationsService(
    {
      findByTokenHash: async () => pending,
      findUserForInvitation: async () => user,
      findActiveMembership: async () => null,
      accept: async (input) => {
        accepted.push(input);
        return { organizationId: input.organizationId };
      },
    },
    {},
    { record: async () => undefined },
    { forRecipient: async () => 'en', forUser: async () => 'en', forEmail: async () => 'en' },
  );

  return { service, accepted };
}

test('a claimable link is accepted by an account whose only identity is a confirmed email', async () => {
  const { service, accepted } = createService({
    invitation: invitation(),
    user: {
      id: USER_ID,
      deletedAt: null,
      emailVerified: VERIFIED_AT,
      accounts: [{ provider: 'email', providerAccountId: 'member@example.com' }],
    },
  });

  const result = await service.accept('raw-invitation-token', USER_ID);

  assert.equal(result.organizationId, ORGANIZATION_ID);
  assert.deepEqual(accepted[0].claim, {
    targetProvider: 'email',
    targetProviderAccountId: 'member@example.com',
  });
  assert.equal(accepted[0].acceptedProviderAccountId, 'member@example.com');
});

test('an email that was never confirmed is not an identity an invitation will accept', async () => {
  const { service } = createService({
    invitation: invitation(),
    user: {
      id: USER_ID,
      deletedAt: null,
      emailVerified: null,
      accounts: [{ provider: 'email', providerAccountId: 'member@example.com' }],
    },
  });

  await assert.rejects(
    service.accept('raw-invitation-token', USER_ID),
    /A Telegram account or a verified email address is required/,
  );
});

test('an account with nothing to identify it cannot accept an invitation', async () => {
  const { service } = createService({
    invitation: invitation(),
    user: { id: USER_ID, deletedAt: null, emailVerified: null, accounts: [] },
  });

  await assert.rejects(
    service.accept('raw-invitation-token', USER_ID),
    /A Telegram account or a verified email address is required/,
  );
});

test('Telegram remains the identity when an account holds both', async () => {
  const { service, accepted } = createService({
    invitation: invitation(),
    user: {
      id: USER_ID,
      deletedAt: null,
      emailVerified: VERIFIED_AT,
      accounts: [
        { provider: 'email', providerAccountId: 'member@example.com' },
        { provider: 'telegram', providerAccountId: '4242' },
      ],
    },
  });

  await service.accept('raw-invitation-token', USER_ID);

  assert.deepEqual(accepted[0].claim, {
    targetProvider: 'telegram',
    targetProviderAccountId: '4242',
  });
});

test('a link already claimed by a Telegram account is not handed to an email account', async () => {
  const { service } = createService({
    invitation: invitation({ targetProvider: 'telegram', targetProviderAccountId: '4242' }),
    user: {
      id: USER_ID,
      deletedAt: null,
      emailVerified: VERIFIED_AT,
      accounts: [{ provider: 'email', providerAccountId: 'member@example.com' }],
    },
  });

  await assert.rejects(
    service.accept('raw-invitation-token', USER_ID),
    /Invitation was already claimed by another account/,
  );
});

test('a link already claimed by one address is not handed to another', async () => {
  const { service } = createService({
    invitation: invitation({
      targetProvider: 'email',
      targetProviderAccountId: 'first@example.com',
    }),
    user: {
      id: USER_ID,
      deletedAt: null,
      emailVerified: VERIFIED_AT,
      accounts: [{ provider: 'email', providerAccountId: 'second@example.com' }],
    },
  });

  await assert.rejects(
    service.accept('raw-invitation-token', USER_ID),
    /Invitation was already claimed by another account/,
  );
});

test('the account that claimed a link may come back to it', async () => {
  const { service, accepted } = createService({
    invitation: invitation({
      targetProvider: 'email',
      targetProviderAccountId: 'member@example.com',
    }),
    user: {
      id: USER_ID,
      deletedAt: null,
      emailVerified: VERIFIED_AT,
      accounts: [{ provider: 'email', providerAccountId: 'member@example.com' }],
    },
  });

  await service.accept('raw-invitation-token', USER_ID);

  assert.equal(accepted.length, 1);
});

test('a Telegram-targeted invitation is still closed to an email account', async () => {
  const { service } = createService({
    invitation: invitation({
      mode: 'targeted_telegram',
      targetProvider: 'telegram',
      targetProviderAccountId: '4242',
    }),
    user: {
      id: USER_ID,
      deletedAt: null,
      emailVerified: VERIFIED_AT,
      accounts: [{ provider: 'email', providerAccountId: 'member@example.com' }],
    },
  });

  await assert.rejects(
    service.accept('raw-invitation-token', USER_ID),
    /Authenticated provider account must match invitation target/,
  );
});
