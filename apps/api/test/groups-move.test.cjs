const assert = require('node:assert/strict');
const test = require('node:test');
const { BadRequestException, NotFoundException } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { ORG_PERMISSIONS } = require('@churchflow/shared');
const { GroupsRepository } = require('../dist/modules/groups/repositories/groups.repository');
const { GroupsService } = require('../dist/modules/groups/groups.service');
const { GroupsController } = require('../dist/modules/groups/groups.controller');
const { OrganizationAccessGuard } = require('../dist/common/guards/organization-access.guard');

const ORGANIZATION_ID = 'organization-a';
const OTHER_ORGANIZATION_ID = 'organization-b';
const ACTOR_USER_ID = 'actor';
const SOURCE_GROUP_ID = 'group-source';
const TARGET_GROUP_ID = 'group-target';
const MEMBERSHIP_ID = 'membership';

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value.in)) return value.in.includes(row[key]);
      return true;
    }
    return row[key] === value;
  });
}

function moveTransaction(options = {}) {
  const {
    sourceOrganizationId = ORGANIZATION_ID,
    targetOrganizationId = ORGANIZATION_ID,
    membershipStatus = 'ACTIVE',
    membershipRemovedAt = null,
    takenBeforeDelete = null,
    groupMemberRows = [
      {
        groupId: SOURCE_GROUP_ID,
        membershipId: MEMBERSHIP_ID,
        organizationId: ORGANIZATION_ID,
        role: 'MEMBER',
      },
    ],
  } = options;

  const writes = [];
  const auditRows = [];
  const groupRows = [
    { id: SOURCE_GROUP_ID, organizationId: sourceOrganizationId, name: 'Worship' },
    { id: TARGET_GROUP_ID, organizationId: targetOrganizationId, name: 'Youth' },
  ];
  const membership = { status: membershipStatus, removedAt: membershipRemovedAt };
  const rows = groupMemberRows.map((row) => ({ ...row }));
  const findRow = (where) => {
    const { membership: membershipWhere, ...rowWhere } = where;
    const present =
      !membershipWhere ||
      (membership.removedAt === null && ['ACTIVE', 'SUSPENDED'].includes(membership.status));
    return present ? (rows.find((row) => matches(row, rowWhere)) ?? null) : null;
  };

  const tx = {
    organizationGroup: {
      findMany: async ({ where }) => groupRows.filter((row) => matches(row, where)),
      findFirstOrThrow: async ({ where }) => {
        const group = groupRows.find((row) => matches(row, where));
        if (!group) throw new Error('not found');
        return {
          ...group,
          members: rows
            .filter((row) => row.groupId === group.id)
            .map((row) => ({
              ...row,
              responsibility: null,
              membership: { id: row.membershipId, profile: null, user: null },
            })),
        };
      },
    },
    organizationGroupMember: {
      findFirst: async ({ where }) => {
        const found = findRow(where);
        if (found) takenBeforeDelete?.(rows, found);
        return found ? { responsibility: found.responsibility ?? null } : null;
      },
      deleteMany: async ({ where }) => {
        const found = findRow(where);
        if (!found) return { count: 0 };
        writes.push({ operation: 'delete', where: { groupId: found.groupId } });
        rows.splice(rows.indexOf(found), 1);
        return { count: 1 };
      },
      upsert: async ({ where, create, update }) => {
        writes.push({ operation: 'upsert', where: where.groupId_membershipId });
        const { groupId, membershipId } = where.groupId_membershipId;
        const existing = rows.find(
          (row) => row.groupId === groupId && row.membershipId === membershipId,
        );
        if (existing) Object.assign(existing, update);
        else rows.push({ ...create });
        return {};
      },
    },
    auditLog: {
      create: async ({ data }) => {
        auditRows.push(data);
        return data;
      },
    },
  };

  return { prisma: { $transaction: async (callback) => callback(tx) }, writes, auditRows, rows };
}

function move(repository, overrides = {}) {
  return repository.moveMember({
    organizationId: ORGANIZATION_ID,
    sourceGroupId: SOURCE_GROUP_ID,
    targetGroupId: TARGET_GROUP_ID,
    membershipId: MEMBERSHIP_ID,
    role: 'MEMBER',
    actorUserId: ACTOR_USER_ID,
    ...overrides,
  });
}

test('a move leaves the source and joins the target in one transaction, audited on both', async () => {
  const { prisma, writes, auditRows, rows } = moveTransaction();
  let transactions = 0;
  const countingPrisma = {
    $transaction: async (callback) => {
      transactions += 1;
      return prisma.$transaction(callback);
    },
  };

  const result = await move(new GroupsRepository(countingPrisma));

  assert.equal(transactions, 1);
  assert.deepEqual(
    writes.map((write) => write.operation),
    ['delete', 'upsert'],
  );
  assert.deepEqual(
    rows.map((row) => [row.groupId, row.role]),
    [[TARGET_GROUP_ID, 'MEMBER']],
  );
  assert.deepEqual(
    auditRows.map((row) => [row.action, row.entityType, row.entityId, row.metadata]),
    [
      [
        'UPDATE',
        'OrganizationGroup',
        SOURCE_GROUP_ID,
        { movedMembershipId: MEMBERSHIP_ID, toGroupId: TARGET_GROUP_ID },
      ],
      [
        'UPDATE',
        'OrganizationGroup',
        TARGET_GROUP_ID,
        { movedMembershipId: MEMBERSHIP_ID, fromGroupId: SOURCE_GROUP_ID, role: 'MEMBER' },
      ],
    ],
  );
  assert.ok(auditRows.every((row) => row.organizationId === ORGANIZATION_ID));
  assert.equal(result.sourceGroup.members.length, 0);
  assert.equal(result.targetGroup.members.length, 1);
});

test('a move onto a leader slot joins the target as a leader', async () => {
  const { prisma, rows } = moveTransaction();

  await move(new GroupsRepository(prisma), { role: 'LEADER' });

  assert.deepEqual(
    rows.map((row) => [row.groupId, row.role]),
    [[TARGET_GROUP_ID, 'LEADER']],
  );
});

test('a person already in the target keeps one row and takes the requested role', async () => {
  const { prisma, rows } = moveTransaction({
    groupMemberRows: [
      {
        groupId: SOURCE_GROUP_ID,
        membershipId: MEMBERSHIP_ID,
        organizationId: ORGANIZATION_ID,
        role: 'MEMBER',
      },
      {
        groupId: TARGET_GROUP_ID,
        membershipId: MEMBERSHIP_ID,
        organizationId: ORGANIZATION_ID,
        role: 'MEMBER',
      },
    ],
  });

  await move(new GroupsRepository(prisma), { role: 'LEADER' });

  assert.deepEqual(
    rows.map((row) => [row.groupId, row.role]),
    [[TARGET_GROUP_ID, 'LEADER']],
  );
});

test('a move carries the responsibility into the new group', async () => {
  const { prisma, rows } = moveTransaction({
    groupMemberRows: [
      {
        groupId: SOURCE_GROUP_ID,
        membershipId: MEMBERSHIP_ID,
        organizationId: ORGANIZATION_ID,
        role: 'MEMBER',
        responsibility: 'Sound desk',
      },
    ],
  });

  await move(new GroupsRepository(prisma));

  assert.deepEqual(
    rows.map((row) => [row.groupId, row.responsibility]),
    [[TARGET_GROUP_ID, 'Sound desk']],
  );
});

test('a person already in the target keeps the responsibility they hold there', async () => {
  const { prisma, rows } = moveTransaction({
    groupMemberRows: [
      {
        groupId: SOURCE_GROUP_ID,
        membershipId: MEMBERSHIP_ID,
        organizationId: ORGANIZATION_ID,
        role: 'MEMBER',
        responsibility: 'Sound desk',
      },
      {
        groupId: TARGET_GROUP_ID,
        membershipId: MEMBERSHIP_ID,
        organizationId: ORGANIZATION_ID,
        role: 'MEMBER',
        responsibility: 'Youth mentor',
      },
    ],
  });

  await move(new GroupsRepository(prisma));

  assert.deepEqual(
    rows.map((row) => [row.groupId, row.responsibility]),
    [[TARGET_GROUP_ID, 'Youth mentor']],
  );
});

test('a concurrent move that already took the row is reported as not found', async () => {
  const { prisma, writes, auditRows } = moveTransaction({
    takenBeforeDelete: (rows, row) => rows.splice(rows.indexOf(row), 1),
  });
  const service = new GroupsService(new GroupsRepository(prisma));

  await assert.rejects(
    service.moveMember(
      ORGANIZATION_ID,
      SOURCE_GROUP_ID,
      MEMBERSHIP_ID,
      { targetGroupId: TARGET_GROUP_ID, role: 'MEMBER' },
      ACTOR_USER_ID,
    ),
    (error) => error instanceof NotFoundException,
  );
  assert.deepEqual(writes, []);
  assert.deepEqual(auditRows, []);
});

test('a move into a group of another organization writes nothing', async () => {
  const { prisma, writes, auditRows } = moveTransaction({
    targetOrganizationId: OTHER_ORGANIZATION_ID,
  });

  assert.equal(await move(new GroupsRepository(prisma)), null);
  assert.deepEqual(writes, []);
  assert.deepEqual(auditRows, []);
});

test('a move out of a group of another organization writes nothing', async () => {
  const { prisma, writes, auditRows } = moveTransaction({
    sourceOrganizationId: OTHER_ORGANIZATION_ID,
  });

  assert.equal(await move(new GroupsRepository(prisma)), null);
  assert.deepEqual(writes, []);
  assert.deepEqual(auditRows, []);
});

test('a membership row of another organization cannot be moved', async () => {
  const { prisma, writes } = moveTransaction({
    groupMemberRows: [
      {
        groupId: SOURCE_GROUP_ID,
        membershipId: MEMBERSHIP_ID,
        organizationId: OTHER_ORGANIZATION_ID,
        role: 'MEMBER',
      },
    ],
  });

  assert.equal(await move(new GroupsRepository(prisma)), null);
  assert.deepEqual(writes, []);
});

test('a removed member cannot be moved', async () => {
  const { prisma, writes } = moveTransaction({
    membershipStatus: 'REMOVED',
    membershipRemovedAt: new Date(),
  });

  assert.equal(await move(new GroupsRepository(prisma)), null);
  assert.deepEqual(writes, []);
});

test('a person who is not in the source group is reported as not found', async () => {
  const { prisma, writes } = moveTransaction({ groupMemberRows: [] });
  const service = new GroupsService(new GroupsRepository(prisma));

  await assert.rejects(
    service.moveMember(
      ORGANIZATION_ID,
      SOURCE_GROUP_ID,
      MEMBERSHIP_ID,
      { targetGroupId: TARGET_GROUP_ID, role: 'MEMBER' },
      ACTOR_USER_ID,
    ),
    (error) => error instanceof NotFoundException,
  );
  assert.deepEqual(writes, []);
});

test('a move onto the same group is rejected before touching the database', async () => {
  let touched = false;
  const service = new GroupsService(
    new GroupsRepository({
      $transaction: async () => {
        touched = true;
      },
    }),
  );

  await assert.rejects(
    service.moveMember(
      ORGANIZATION_ID,
      SOURCE_GROUP_ID,
      MEMBERSHIP_ID,
      { targetGroupId: SOURCE_GROUP_ID, role: 'MEMBER' },
      ACTOR_USER_ID,
    ),
    (error) => error instanceof BadRequestException,
  );
  assert.equal(touched, false);
});

function guard({ role, permissions = [] }) {
  const prisma = {
    user: {
      findUnique: async () => ({
        platformRole: 'USER',
        deletedAt: null,
        memberships: role ? [{ role, permissions }] : [],
      }),
    },
    organization: { findFirst: async () => ({ id: ORGANIZATION_ID }) },
  };

  return new OrganizationAccessGuard(prisma, new Reflector());
}

function context(handlerName) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        params: { organizationId: ORGANIZATION_ID },
        auth: { userId: 'user' },
      }),
    }),
    getHandler: () => GroupsController.prototype[handlerName],
    getClass: () => GroupsController,
  };
}

async function isRefused(promise) {
  try {
    await promise;
    return false;
  } catch (error) {
    assert.equal(error.getStatus(), 403);
    return true;
  }
}

test('board mutations need members.manage, while the board itself is open to every member', async () => {
  for (const handler of ['moveMember', 'saveBoardLayout']) {
    assert.equal(await guard({ role: 'ADMIN' }).canActivate(context(handler)), true);
    assert.equal(
      await guard({ role: 'MEMBER', permissions: [ORG_PERMISSIONS.membersManage] }).canActivate(
        context(handler),
      ),
      true,
    );
    assert.equal(await isRefused(guard({ role: 'MEMBER' }).canActivate(context(handler))), true);
    assert.equal(await isRefused(guard({ role: 'VIEWER' }).canActivate(context(handler))), true);
  }

  assert.equal(await guard({ role: 'VIEWER' }).canActivate(context('board')), true);
  assert.equal(await guard({ role: 'MEMBER' }).canActivate(context('board')), true);
});
