const assert = require('node:assert/strict');
const test = require('node:test');
const {
  GroupsRepository,
  UnknownGroupMembershipsError,
} = require('../dist/modules/groups/repositories/groups.repository');

const ORGANIZATION_ID = 'organization-a';
const OTHER_ORGANIZATION_ID = 'organization-b';
const ACTOR_USER_ID = 'actor';
const GROUP_ID = 'group';
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

function groupTransaction(options = {}) {
  const {
    groupOrganizationId = ORGANIZATION_ID,
    membershipOrganizationId = ORGANIZATION_ID,
    membershipStatus = 'ACTIVE',
    membershipRemovedAt = null,
    groupMemberRows = [
      { groupId: GROUP_ID, membershipId: MEMBERSHIP_ID, organizationId: ORGANIZATION_ID },
    ],
  } = options;

  const writes = [];
  const write = (operation) => async (args) => {
    writes.push({ operation, args });
    return { id: GROUP_ID, count: Array.isArray(args.data) ? args.data.length : 1 };
  };

  const groupRows = [{ id: GROUP_ID, organizationId: groupOrganizationId, name: 'Worship' }];
  const memberRows = [
    {
      id: MEMBERSHIP_ID,
      organizationId: membershipOrganizationId,
      status: membershipStatus,
      removedAt: membershipRemovedAt,
    },
  ];

  const tx = {
    organizationGroup: {
      findFirst: async ({ where }) => groupRows.find((row) => matches(row, where)) ?? null,
      findFirstOrThrow: async () => ({ ...groupRows[0], members: [] }),
      create: write('organizationGroup.create'),
      update: write('organizationGroup.update'),
      delete: write('organizationGroup.delete'),
    },
    organizationMember: {
      findMany: async ({ where }) => memberRows.filter((row) => matches(row, where)),
    },
    organizationGroupMember: {
      findFirst: async ({ where }) => groupMemberRows.find((row) => matches(row, where)) ?? null,
      upsert: write('organizationGroupMember.upsert'),
      update: write('organizationGroupMember.update'),
      delete: write('organizationGroupMember.delete'),
    },
    auditLog: { create: write('auditLog.create') },
  };

  return { prisma: { $transaction: async (callback) => callback(tx) }, writes };
}

test('adding a member of another organization is refused', async () => {
  const { prisma, writes } = groupTransaction({
    membershipOrganizationId: OTHER_ORGANIZATION_ID,
  });
  const repository = new GroupsRepository(prisma);

  await assert.rejects(
    repository.addMembers({
      organizationId: ORGANIZATION_ID,
      groupId: GROUP_ID,
      actorUserId: ACTOR_USER_ID,
      members: [{ membershipId: MEMBERSHIP_ID, role: 'MEMBER', responsibility: null }],
    }),
    (error) => error instanceof UnknownGroupMembershipsError,
  );
  assert.deepEqual(writes, []);
});

test('adding a removed member is refused', async () => {
  const { prisma, writes } = groupTransaction({
    membershipStatus: 'REMOVED',
    membershipRemovedAt: new Date(),
  });
  const repository = new GroupsRepository(prisma);

  await assert.rejects(
    repository.addMembers({
      organizationId: ORGANIZATION_ID,
      groupId: GROUP_ID,
      actorUserId: ACTOR_USER_ID,
      members: [{ membershipId: MEMBERSHIP_ID, role: 'LEADER', responsibility: null }],
    }),
    (error) => error instanceof UnknownGroupMembershipsError,
  );
  assert.deepEqual(writes, []);
});

test('updating a group of another organization writes nothing', async () => {
  const { prisma, writes } = groupTransaction({ groupOrganizationId: OTHER_ORGANIZATION_ID });
  const repository = new GroupsRepository(prisma);

  const result = await repository.update({
    organizationId: ORGANIZATION_ID,
    groupId: GROUP_ID,
    actorUserId: ACTOR_USER_ID,
    group: { name: 'Renamed' },
  });

  assert.equal(result, null);
  assert.deepEqual(writes, []);
});

test('deleting a group of another organization writes nothing', async () => {
  const { prisma, writes } = groupTransaction({ groupOrganizationId: OTHER_ORGANIZATION_ID });
  const repository = new GroupsRepository(prisma);

  assert.equal(
    await repository.delete({
      organizationId: ORGANIZATION_ID,
      groupId: GROUP_ID,
      actorUserId: ACTOR_USER_ID,
    }),
    false,
  );
  assert.deepEqual(writes, []);
});

test('a membership row of another organization cannot be updated through this organization', async () => {
  const { prisma, writes } = groupTransaction({
    groupMemberRows: [
      { groupId: GROUP_ID, membershipId: MEMBERSHIP_ID, organizationId: OTHER_ORGANIZATION_ID },
    ],
  });
  const repository = new GroupsRepository(prisma);

  const result = await repository.updateMember({
    organizationId: ORGANIZATION_ID,
    groupId: GROUP_ID,
    membershipId: MEMBERSHIP_ID,
    actorUserId: ACTOR_USER_ID,
    member: { role: 'LEADER' },
  });

  assert.equal(result, null);
  assert.deepEqual(writes, []);
});
