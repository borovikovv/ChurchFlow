const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MembershipClaimsService,
} = require('../dist/modules/membership-claims/membership-claims.service.js');
const {
  MembershipClaimsRepository,
} = require('../dist/modules/membership-claims/repositories/membership-claims.repository.js');

const TOKEN = 'raw-token-that-is-long-enough-for-validation';

function createUserLocaleService(locale = 'en') {
  return {
    forUser: async () => locale,
    forEmail: async () => null,
    forRecipient: async () => locale,
  };
}

function createRepository(overrides = {}) {
  return {
    findByTokenHash: async () => ({ membership: { organizationId: 'organization' } }),
    request: async () => ({
      expired: false,
      id: 'claim',
      status: 'REQUESTED',
      organizationId: 'organization',
      memberName: 'Maria',
    }),
    listAdminMembershipIds: async () => ['owner-membership', 'admin-membership'],
    ...overrides,
  };
}

function createService(repository, notificationsService) {
  return new MembershipClaimsService(
    repository,
    {},
    createUserLocaleService(),
    { assert: async () => undefined },
    notificationsService,
  );
}

test('requesting a membership claim notifies organization owners and admins', async () => {
  const captured = {};
  const repository = createRepository({
    listAdminMembershipIds: async (organizationId, excludedUserId) => {
      captured.recipients = { organizationId, excludedUserId };
      return ['owner-membership', 'admin-membership'];
    },
  });
  const service = createService(repository, {
    createAdminMembershipChangeNotifications: async (input) => {
      captured.notification = input;
      return { createdCount: 2, emailSentCount: 0, telegramSentCount: 0 };
    },
  });

  const result = await service.request(TOKEN, 'claimant');

  assert.deepEqual(result, { expired: false, id: 'claim', status: 'REQUESTED' });
  assert.deepEqual(captured.recipients, {
    organizationId: 'organization',
    excludedUserId: 'claimant',
  });
  assert.equal(captured.notification.type, 'MEMBERSHIP_CLAIM_REQUESTED');
  assert.equal(captured.notification.dedupeKey, 'membership-claim-requested:claim');
  assert.equal(captured.notification.preferenceKey, 'organizationUpdatesEnabled');
  assert.equal(captured.notification.titleKey, 'membershipClaimRequested');
  assert.deepEqual(captured.notification.bodyMessage, {
    key: 'membershipClaimRequested',
    memberName: 'Maria',
  });
  assert.equal(captured.notification.url, '/dashboard/organization/members');
  assert.equal(captured.notification.entityType, 'MembershipClaim');
  assert.equal(captured.notification.entityId, 'claim');
  assert.equal(captured.notification.actorUserId, 'claimant');
  assert.equal(captured.notification.adminOnly, true);
  assert.deepEqual(captured.notification.recipientMembershipIds, [
    'owner-membership',
    'admin-membership',
  ]);
});

test('a failed admin notification does not fail the membership claim request', async () => {
  const service = createService(createRepository(), {
    createAdminMembershipChangeNotifications: async () => {
      throw new Error('notification storage unavailable');
    },
  });

  const result = await service.request(TOKEN, 'claimant');

  assert.deepEqual(result, { expired: false, id: 'claim', status: 'REQUESTED' });
});

test('an expired or unavailable claim request does not notify admins', async () => {
  let notified = 0;
  const notificationsService = {
    createAdminMembershipChangeNotifications: async () => {
      notified += 1;
      return { createdCount: 0, emailSentCount: 0, telegramSentCount: 0 };
    },
  };

  await assert.rejects(
    createService(
      createRepository({ request: async () => ({ expired: true }) }),
      notificationsService,
    ).request(TOKEN, 'claimant'),
    /Membership claim has expired/,
  );
  await assert.rejects(
    createService(
      createRepository({
        request: async () => {
          throw new Error('CLAIM_NOT_PENDING');
        },
      }),
      notificationsService,
    ).request(TOKEN, 'claimant'),
    /Membership claim is no longer available/,
  );

  assert.equal(notified, 0);
});

test('membership claim repository request returns the organization and member name', async () => {
  const repository = new MembershipClaimsRepository({
    $transaction: async (callback) =>
      callback({
        membershipClaim: {
          findUnique: async () => ({
            id: 'claim',
            membershipId: 'membership',
            status: 'PENDING',
            requestedByUserId: null,
            expiresAt: new Date(Date.now() + 60_000),
            membership: {
              userId: null,
              status: 'ACTIVE',
              removedAt: null,
              organizationId: 'organization',
              organization: { status: 'ACTIVE', deletedAt: null },
              profile: { displayName: 'Maria' },
            },
          }),
          updateMany: async () => ({ count: 1 }),
        },
        user: {
          findFirst: async ({ where }) => ({
            id: where.id,
            emailVerified: null,
            accounts: [{ provider: 'telegram', providerAccountId: `telegram-${where.id}` }],
          }),
        },
        auditLog: { create: async () => ({}) },
      }),
  });

  assert.deepEqual(await repository.request('token-hash', 'claimant'), {
    expired: false,
    id: 'claim',
    status: 'REQUESTED',
    organizationId: 'organization',
    memberName: 'Maria',
  });
});

test('membership claim repository lists active owners and admins except the claimant', async () => {
  let capturedWhere;
  const repository = new MembershipClaimsRepository({
    organizationMember: {
      findMany: async ({ where }) => {
        capturedWhere = where;
        return [{ id: 'owner-membership' }, { id: 'admin-membership' }];
      },
    },
  });

  assert.deepEqual(await repository.listAdminMembershipIds('organization', 'claimant'), [
    'owner-membership',
    'admin-membership',
  ]);
  assert.equal(capturedWhere.organizationId, 'organization');
  assert.deepEqual(capturedWhere.role, { in: ['OWNER', 'ADMIN'] });
  assert.equal(capturedWhere.status, 'ACTIVE');
  assert.equal(capturedWhere.removedAt, null);
  assert.deepEqual(capturedWhere.userId, { not: null });
  assert.deepEqual(capturedWhere.AND, [{ userId: { not: 'claimant' } }]);
  assert.deepEqual(capturedWhere.organization, { status: 'ACTIVE', deletedAt: null });
});
