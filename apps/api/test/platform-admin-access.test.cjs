const assert = require('node:assert/strict');
const test = require('node:test');
const { ForbiddenException } = require('@nestjs/common');
const { ORG_PERMISSIONS } = require('@churchflow/shared');
const { assertOrganizationAccess } = require('../dist/common/guards/organization-access.guard');
const { AiToolRunner } = require('../dist/modules/ai-assistant/tools/ai-tool-runner');
const { BUDGET_TOOL_META } = require('../dist/modules/ai-assistant/tools/budget.tools');
const { GROUPS_TOOL_META } = require('../dist/modules/ai-assistant/tools/groups.tools');

const ORG = 'organization-a';
const USER = 'user-1';
const MEMBERSHIPS = [null, 'OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

function createPrisma({ role, permissions = [], platformRole = 'SUPER_ADMIN' }) {
  return {
    user: {
      findUnique: async () => ({
        platformRole,
        deletedAt: null,
        memberships: role ? [{ role, permissions }] : [],
      }),
    },
    organization: { findFirst: async () => ({ id: ORG }) },
  };
}

function access(options, requirement = {}) {
  return assertOrganizationAccess(createPrisma(options), {
    userId: USER,
    organizationId: ORG,
    ...requirement,
  });
}

function runner(options) {
  return new AiToolRunner(
    {
      prisma: createPrisma(options),
      entitlementsService: { assert: async () => undefined },
      repository: {},
      auditService: {},
    },
    { organizationId: ORG, userId: USER },
  );
}

test('routes keep letting a platform admin through, whatever their membership', async () => {
  // The admin area depends on this; only callers that ask for the membership role lose it.
  for (const role of MEMBERSHIPS) {
    for (const requirement of [
      {},
      { ownerRequired: true },
      { permission: ORG_PERMISSIONS.membersManage },
    ]) {
      const result = await access({ role }, requirement);
      assert.equal(result.platformAdmin, true, `${role} ${JSON.stringify(requirement)}`);
      assert.equal(result.role, role);
    }
  }
});

test('held to their membership, a platform admin is owner only when they own the church', async () => {
  assert.equal(
    (await access({ role: 'OWNER' }, { ownerRequired: true, enforceMembershipRole: true })).role,
    'OWNER',
  );

  for (const role of [null, 'ADMIN', 'MEMBER', 'VIEWER']) {
    await assert.rejects(
      () => access({ role }, { ownerRequired: true, enforceMembershipRole: true }),
      ForbiddenException,
      String(role),
    );
  }
});

test('held to their membership, a platform admin needs the permission like anyone else', async () => {
  const requirement = {
    permission: ORG_PERMISSIONS.membersManage,
    enforceMembershipRole: true,
  };

  for (const role of ['OWNER', 'ADMIN']) {
    assert.equal((await access({ role }, requirement)).role, role);
  }
  assert.equal(
    (await access({ role: 'MEMBER', permissions: [ORG_PERMISSIONS.membersManage] }, requirement))
      .role,
    'MEMBER',
  );

  for (const role of [null, 'MEMBER', 'VIEWER']) {
    await assert.rejects(() => access({ role }, requirement), ForbiddenException, String(role));
  }
});

test('held to their membership, a platform admin may still read what any member may', async () => {
  const result = await access({ role: null }, { enforceMembershipRole: true });

  assert.deepEqual(result, { platformAdmin: true, role: null, permissions: [] });
});

test('the flag changes nothing for an ordinary member', async () => {
  for (const enforceMembershipRole of [false, true]) {
    await assert.rejects(
      () =>
        access(
          { role: 'ADMIN', platformRole: 'USER' },
          { ownerRequired: true, enforceMembershipRole },
        ),
      ForbiddenException,
    );
    assert.equal(
      (
        await access(
          { role: 'OWNER', platformRole: 'USER' },
          { ownerRequired: true, enforceMembershipRole },
        )
      ).role,
      'OWNER',
    );
  }
});

test('the assistant refuses an owner-only tool to a platform admin who does not own the church', async () => {
  for (const role of [null, 'ADMIN', 'MEMBER', 'VIEWER']) {
    await assert.rejects(
      () => runner({ role }).authorize(BUDGET_TOOL_META.budgetSummary),
      ForbiddenException,
      String(role),
    );
  }

  await runner({ role: 'OWNER' }).authorize(BUDGET_TOOL_META.budgetSummary);
});

test('the assistant holds a platform admin to the permission a write tool needs', async () => {
  const meta = GROUPS_TOOL_META.addGroupMember;

  for (const role of [null, 'MEMBER', 'VIEWER']) {
    await assert.rejects(() => runner({ role }).authorize(meta), ForbiddenException, String(role));
  }

  await runner({ role: 'ADMIN' }).authorize(meta);
  await runner({ role: 'MEMBER', permissions: [ORG_PERMISSIONS.membersManage] }).authorize(meta);
});
