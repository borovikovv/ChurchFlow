const assert = require('node:assert/strict');
const test = require('node:test');
const { ORG_PERMISSIONS } = require('@churchflow/shared');
const { OrganizationAccessGuard } = require('../dist/common/guards/organization-access.guard.js');

const ORGANIZATION_ID = 'organization-a';
const USER_ID = 'user-a';
const OWNER_KEY = 'organizationOwner';
const PERMISSION_KEY = 'organizationPermission';

function createGuard(options = {}) {
  const {
    role = 'OWNER',
    permissions = [],
    platformRole = 'USER',
    metadata = {},
    membership = true,
  } = options;

  const prisma = {
    user: {
      findUnique: async () => ({
        platformRole,
        deletedAt: null,
        memberships: membership ? [{ role, permissions }] : [],
      }),
    },
    organization: {
      findFirst: async () => ({ id: ORGANIZATION_ID }),
    },
  };
  const reflector = {
    getAllAndOverride: (key) => metadata[key],
  };

  return new OrganizationAccessGuard(prisma, reflector);
}

function executionContext() {
  const request = { auth: { userId: USER_ID }, params: { organizationId: ORGANIZATION_ID } };

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => {},
    getClass: () => class {},
  };
}

const ownerOnly = { [OWNER_KEY]: true };

test('an owner-only route admits the owner', async () => {
  const guard = createGuard({ role: 'OWNER', metadata: ownerOnly });

  assert.equal(await guard.canActivate(executionContext()), true);
});

test('an owner-only route rejects every other organization role', async () => {
  for (const role of ['ADMIN', 'MEMBER', 'VIEWER']) {
    const guard = createGuard({ role, metadata: ownerOnly });

    await assert.rejects(guard.canActivate(executionContext()), {
      message: 'Organization owner role is required',
    });
  }
});

test('a granular grant cannot widen an owner-only route', async () => {
  const guard = createGuard({
    role: 'MEMBER',
    permissions: [ORG_PERMISSIONS.websiteManage],
    metadata: { ...ownerOnly, [PERMISSION_KEY]: ORG_PERMISSIONS.websiteManage },
  });

  await assert.rejects(guard.canActivate(executionContext()), {
    message: 'Organization owner role is required',
  });
});

test('platform administrators keep their bypass on owner-only routes', async () => {
  for (const platformRole of ['ADMIN', 'SUPER_ADMIN']) {
    const guard = createGuard({ platformRole, membership: false, metadata: ownerOnly });

    assert.equal(await guard.canActivate(executionContext()), true);
  }
});

test('routes without the owner marker keep their previous access', async () => {
  const unmarked = createGuard({ role: 'ADMIN' });
  assert.equal(await unmarked.canActivate(executionContext()), true);

  const permissionOnly = createGuard({
    role: 'ADMIN',
    metadata: { [PERMISSION_KEY]: ORG_PERMISSIONS.billingManage },
  });
  assert.equal(await permissionOnly.canActivate(executionContext()), true);

  const granted = createGuard({
    role: 'MEMBER',
    permissions: [ORG_PERMISSIONS.billingManage],
    metadata: { [PERMISSION_KEY]: ORG_PERMISSIONS.billingManage },
  });
  assert.equal(await granted.canActivate(executionContext()), true);

  const ungranted = createGuard({
    role: 'MEMBER',
    metadata: { [PERMISSION_KEY]: ORG_PERMISSIONS.billingManage },
  });
  await assert.rejects(ungranted.canActivate(executionContext()), {
    message: 'Organization permission is required',
  });
});
