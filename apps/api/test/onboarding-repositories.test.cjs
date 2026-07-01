const assert = require('node:assert/strict');
const test = require('node:test');
const { Prisma } = require('@churchflow/db');
const { AuthRepository } = require('../dist/modules/auth/auth.repository.js');
const {
  OrganizationRequestsRepository,
} = require('../dist/modules/organization-requests/repositories/organization-requests.repository.js');
const {
  OrganizationsRepository,
} = require('../dist/modules/organizations/repositories/organizations.repository.js');
const { OrganizationsService } = require('../dist/modules/organizations/organizations.service.js');
const { OrganizationAccessGuard } = require('../dist/common/guards/organization-access.guard.js');

function uniqueConflict(target = ['provider', 'provider_account_id']) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.8.0',
    meta: { target },
  });
}

test('parallel Telegram admissions converge on one active user and account', async () => {
  let account = null;
  let nextUser = 0;
  const committedUsers = new Set();
  const prisma = {
    authAccount: {
      findUnique: async () =>
        account
          ? {
              id: account.id,
              deletedAt: null,
              user: {
                ...account.user,
                deletedAt: null,
                memberships: [],
                requestedOrganizationRequests: [],
                requestedMembershipClaims: [],
              },
            }
          : null,
    },
    $transaction: async (callback) => {
      let stagedUser;
      const result = await callback({
        user: {
          create: async () => {
            nextUser += 1;
            stagedUser = {
              id: `user-${nextUser}`,
              email: null,
              displayName: 'Telegram User',
              platformRole: 'USER',
            };
            return stagedUser;
          },
        },
        authAccount: {
          create: async ({ data }) => {
            if (account) {
              throw uniqueConflict();
            }
            await Promise.resolve();
            if (account) {
              throw uniqueConflict();
            }
            account = { id: 'telegram-account', user: stagedUser, data };
          },
        },
      });
      committedUsers.add(result.id);
      return result;
    },
  };
  const repository = new AuthRepository(prisma);

  const users = await Promise.all([
    repository.createTelegramUserForAdmission({ providerAccountId: 'telegram-sub' }),
    repository.createTelegramUserForAdmission({ providerAccountId: 'telegram-sub' }),
  ]);

  assert.equal(users[0].id, users[1].id);
  assert.equal(account.data.providerAccountId, 'telegram-sub');
  assert.deepEqual([...committedUsers], [users[0].id]);
});

test('request creation expires stale pending rows and writes audit in one transaction', async () => {
  const calls = [];
  const request = {
    id: 'request-1',
    organizationName: 'Grace Church',
    contactName: 'Requester',
    contactEmail: null,
    contactPhone: null,
    message: null,
    requestedBy: { accounts: [{ providerAccountId: 'telegram-sub' }] },
  };
  const prisma = {
    $transaction: async (callback) =>
      callback({
        user: { findFirst: async () => ({ id: 'user-1' }) },
        organizationRequest: {
          updateMany: async (input) => calls.push(['expire', input]),
          create: async (input) => {
            calls.push(['create', input]);
            return request;
          },
        },
        auditLog: {
          create: async (input) => calls.push(['audit', input]),
        },
      }),
  };
  const repository = new OrganizationRequestsRepository(prisma);
  const staleBefore = new Date('2026-06-01T00:00:00.000Z');

  const result = await repository.create(
    { organizationName: 'Grace Church', contactName: 'Requester' },
    'user-1',
    staleBefore,
  );

  assert.equal(result.id, request.id);
  assert.equal(calls[0][0], 'expire');
  assert.equal(calls[0][1].where.createdAt.lte, staleBefore);
  assert.equal(calls[2][0], 'audit');
  assert.equal(calls[2][1].data.entityType, 'OrganizationRequest');
});

test('approval creates one organization, website, owner and audit trail', async () => {
  const state = { status: 'PENDING', organizations: [], memberships: [], audits: [] };
  const prisma = {
    $transaction: async (callback) =>
      callback({
        organizationRequest: {
          updateMany: async ({ where, data }) => {
            if (where.createdAt) {
              return { count: 0 };
            }
            if (state.status !== 'PENDING') {
              return { count: 0 };
            }
            state.status = data.status;
            return { count: 1 };
          },
          findUniqueOrThrow: async () => ({ id: 'request-1', requestedByUserId: 'user-1' }),
          update: async () => ({}),
        },
        user: { findFirst: async () => ({ id: 'user-1' }) },
        organization: {
          create: async ({ data }) => {
            const organization = { id: 'organization-1', name: data.name, slug: data.slug };
            state.organizations.push({ ...organization, website: data.website.create });
            return organization;
          },
        },
        organizationMember: {
          create: async ({ data }) => {
            const membership = { id: 'membership-1', ...data };
            state.memberships.push(membership);
            return membership;
          },
        },
        auditLog: { create: async ({ data }) => state.audits.push(data) },
      }),
  };
  const repository = new OrganizationRequestsRepository(prisma);
  const input = {
    id: 'request-1',
    organizationName: 'Grace Church',
    organizationSlug: 'grace-church',
    actorUserId: 'admin-1',
    staleBefore: new Date('2026-06-01T00:00:00.000Z'),
  };

  await repository.approve(input);
  await assert.rejects(repository.approve(input), /ORGANIZATION_REQUEST_NOT_PENDING/);

  assert.equal(state.organizations.length, 1);
  assert.equal(state.organizations[0].website.title, 'Grace Church');
  assert.equal(state.memberships[0].role, 'OWNER');
  assert.equal(state.audits.length, 2);
});

test('audit failure aborts request creation transaction', async () => {
  const state = { requests: [] };
  const prisma = {
    $transaction: async (callback) => {
      const staged = [];
      const result = await callback({
        user: { findFirst: async () => ({ id: 'user-1' }) },
        organizationRequest: {
          updateMany: async () => ({ count: 0 }),
          create: async () => {
            const request = {
              id: 'request-1',
              organizationName: 'Grace Church',
              contactName: 'Requester',
              contactEmail: null,
              contactPhone: null,
              message: null,
              requestedBy: { accounts: [] },
            };
            staged.push(request);
            return request;
          },
        },
        auditLog: { create: async () => Promise.reject(new Error('AUDIT_FAILED')) },
      });
      state.requests.push(...staged);
      return result;
    },
  };
  const repository = new OrganizationRequestsRepository(prisma);

  await assert.rejects(
    repository.create(
      { organizationName: 'Grace Church', contactName: 'Requester' },
      'user-1',
      new Date(),
    ),
    /AUDIT_FAILED/,
  );
  assert.equal(state.requests.length, 0);
});

test('expired request resubmission preserves history and creates a pending request with audit', async () => {
  const createdAt = new Date('2026-07-01T20:00:00.000Z');
  const previousRequest = {
    id: 'expired-request',
    organizationName: 'Grace Church',
    organizationSlug: 'grace-church',
    contactName: 'Requester',
    contactEmail: 'requester@example.com',
    contactTelegramId: null,
    contactTelegramUsername: null,
    contactPhone: null,
    message: 'Please review again',
    requestedByUserId: 'user-1',
    createdOrganizationId: null,
    status: 'EXPIRED',
    requestedBy: { accounts: [{ providerAccountId: 'telegram-sub' }] },
  };
  const captured = { created: null, audit: null, deleted: false };
  const prisma = {
    $transaction: async (callback) =>
      callback({
        organizationRequest: {
          updateMany: async () => ({ count: 0 }),
          findUnique: async () => previousRequest,
          findFirst: async () => null,
          create: async ({ data }) => {
            captured.created = data;
            return {
              id: 'resubmitted-request',
              ...data,
              createdAt,
              requestedBy: previousRequest.requestedBy,
            };
          },
          delete: async () => {
            captured.deleted = true;
          },
        },
        auditLog: {
          create: async ({ data }) => {
            captured.audit = data;
          },
        },
      }),
  };
  const repository = new OrganizationRequestsRepository(prisma);

  const result = await repository.resubmitExpired(
    previousRequest.id,
    'user-1',
    new Date('2026-07-01T00:00:00.000Z'),
  );

  assert.equal(result.id, 'resubmitted-request');
  assert.equal(captured.created.requestedByUserId, 'user-1');
  assert.equal(captured.audit.action, 'CREATE');
  assert.equal(captured.audit.metadata.previousRequestId, previousRequest.id);
  assert.equal(captured.deleted, false);
});

test('only the original requester can resubmit or delete an organization request', async () => {
  const repository = new OrganizationRequestsRepository({
    $transaction: async (callback) =>
      callback({
        organizationRequest: {
          updateMany: async () => ({ count: 0 }),
          findUnique: async () => ({
            id: 'request-1',
            requestedByUserId: 'original-owner',
            status: 'EXPIRED',
            createdOrganizationId: null,
          }),
        },
      }),
  });

  await assert.rejects(
    repository.resubmitExpired('request-1', 'different-user', new Date()),
    /ORGANIZATION_REQUEST_NOT_FOUND/,
  );
  await assert.rejects(
    repository.deleteFromHistory('request-1', 'different-user'),
    /ORGANIZATION_REQUEST_NOT_FOUND/,
  );
});

test('resubmission fails when the requester already has a pending request', async () => {
  const previousRequest = {
    id: 'expired-request',
    requestedByUserId: 'user-1',
    status: 'EXPIRED',
    createdOrganizationId: null,
    requestedBy: { accounts: [{ providerAccountId: 'telegram-sub' }] },
  };
  const repository = new OrganizationRequestsRepository({
    $transaction: async (callback) =>
      callback({
        organizationRequest: {
          updateMany: async () => ({ count: 0 }),
          findUnique: async () => previousRequest,
          findFirst: async () => ({ id: 'pending-request' }),
        },
      }),
  });

  await assert.rejects(
    repository.resubmitExpired(previousRequest.id, 'user-1', new Date()),
    /ORGANIZATION_REQUEST_PENDING_EXISTS/,
  );
});

test('pending and approved organization requests cannot be deleted from history', async () => {
  for (const status of ['PENDING', 'APPROVED']) {
    const repository = new OrganizationRequestsRepository({
      $transaction: async (callback) =>
        callback({
          organizationRequest: {
            findUnique: async () => ({
              id: `${status.toLowerCase()}-request`,
              requestedByUserId: 'user-1',
              status,
              createdOrganizationId: status === 'APPROVED' ? 'organization-1' : null,
            }),
          },
        }),
    });

    await assert.rejects(
      repository.deleteFromHistory(`${status.toLowerCase()}-request`, 'user-1'),
      /ORGANIZATION_REQUEST_NOT_DELETABLE/,
    );
  }
});

test('deleting an expired request writes audit before hard deletion', async () => {
  const calls = [];
  const repository = new OrganizationRequestsRepository({
    $transaction: async (callback) =>
      callback({
        organizationRequest: {
          findUnique: async () => ({
            id: 'expired-request',
            organizationName: 'Grace Church',
            requestedByUserId: 'user-1',
            status: 'EXPIRED',
            createdOrganizationId: null,
          }),
          delete: async ({ where }) => calls.push(['delete', where]),
        },
        auditLog: {
          create: async ({ data }) => calls.push(['audit', data]),
        },
      }),
  });

  await repository.deleteFromHistory('expired-request', 'user-1');

  assert.equal(calls[0][0], 'audit');
  assert.equal(calls[0][1].action, 'DELETE');
  assert.equal(calls[1][0], 'delete');
  assert.equal(calls[1][1].id, 'expired-request');
});

test('direct admin creation builds the full aggregate and audit entry', async () => {
  const captured = {};
  const prisma = {
    $transaction: async (callback) =>
      callback({
        user: { findFirst: async () => ({ id: 'admin-1' }) },
        organization: {
          create: async ({ data }) => {
            captured.organization = data;
            return { id: 'organization-1', name: data.name, slug: data.slug };
          },
        },
        auditLog: {
          create: async ({ data }) => {
            captured.audit = data;
          },
        },
      }),
  };
  const repository = new OrganizationsRepository(prisma);

  await repository.create({ name: 'Grace Church', slug: 'grace-church' }, 'admin-1');

  assert.equal(captured.organization.website.create.title, 'Grace Church');
  assert.equal(captured.organization.members.create.role, 'OWNER');
  assert.deepEqual(captured.organization.members.create.permissions, undefined);
  assert.equal(captured.audit.metadata.source, 'platform_admin_direct_creation');
});

test('duplicate direct organization slug is exposed as conflict', async () => {
  const service = new OrganizationsService(
    { create: async () => Promise.reject(uniqueConflict(['slug'])) },
    {},
  );

  await assert.rejects(
    service.create({ name: 'Grace Church', slug: 'grace-church' }, 'admin-1'),
    /Organization slug is already in use/,
  );
});

test('restricted requester has no tenant access without active membership', async () => {
  const guard = new OrganizationAccessGuard(
    {
      user: { findUnique: async () => ({ platformRole: 'USER', deletedAt: null }) },
      organizationMember: { findFirst: async () => null },
    },
    { getAllAndOverride: () => undefined },
  );
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ auth: { sub: 'user-1' }, params: { organizationId: 'org-1' } }),
    }),
    getHandler: () => null,
    getClass: () => null,
  };

  await assert.rejects(guard.canActivate(context), /Organization access is required/);
});
