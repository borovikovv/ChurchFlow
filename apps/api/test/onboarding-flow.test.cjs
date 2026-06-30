const assert = require('node:assert/strict');
const test = require('node:test');
const { AuthService } = require('../dist/modules/auth/auth.service.js');
const {
  OrganizationRequestsService,
} = require('../dist/modules/organization-requests/organization-requests.service.js');
const { InvitationsService } = require('../dist/modules/invitations/invitations.service.js');
const { MembershipsService } = require('../dist/modules/memberships/memberships.service.js');

const telegramClaims = {
  iss: 'https://oauth.telegram.org',
  aud: 'churchflow',
  sub: 'telegram-user-1',
  exp: Math.floor(Date.now() / 1000) + 300,
  iat: Math.floor(Date.now() / 1000),
  name: 'New User',
};

function createAuthRepository(overrides = {}) {
  return {
    hasPendingTelegramInvitation: async () => false,
    hasValidClaimableInvitationTokenHash: async () => false,
    hasValidPlatformAdminBootstrapTokenHash: async () => false,
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

function createAuthService(repository) {
  return new AuthService(
    {
      getOrThrow() {
        throw new Error('Config should not be read in admission tests');
      },
    },
    repository,
  );
}

test('unknown Telegram user is admitted from the organization request route', async () => {
  const service = createAuthService(createAuthRepository());

  const result = await service.resolveTelegramLoginUser(
    telegramClaims,
    '/organization-request',
  );

  assert.equal(result.defaultRedirectTo, '/organization-request');
  assert.equal(result.user.platformRole, 'USER');
});

test('unknown Telegram user is rejected by ordinary login', async () => {
  const service = createAuthService(createAuthRepository());

  await assert.rejects(
    service.resolveTelegramLoginUser(telegramClaims),
    /Account is not invited to ChurchFlow/,
  );
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
      findPendingByRequester: async () => ({ id: 'pending-request' }),
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

test('email failure does not fail a committed organization request', async () => {
  const service = new OrganizationRequestsService(
    {
      findPendingByRequester: async () => null,
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
      sendOrganizationRequestAdminEmail: async () => {
        throw new Error('Email provider unavailable');
      },
    },
    { record: async () => undefined },
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

test('claimable invitation cannot grant an elevated role', async () => {
  const service = new InvitationsService(
    {
      findActiveOrganization: async () => ({ id: 'organization', name: 'Grace Church' }),
      findActiveMembership: async () => ({ role: 'OWNER' }),
    },
    {},
    {},
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
  );

  const result = await service.createForOrganization(
    '5d39df8a-3180-4311-bc25-4d858f6d663b',
    { mode: 'claimable_link', role: 'MEMBER', email: 'member@example.com' },
    'b919dd9a-12d5-4460-b0e2-f22f85ca507b',
  );

  assert.equal(result.emailSent, false);
  assert.match(result.acceptUrl, /^https:\/\/churchflow\.test\/invitations\//);
});
