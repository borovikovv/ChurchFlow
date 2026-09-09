const assert = require('node:assert/strict');
const test = require('node:test');
const { GroupsRepository } = require('../dist/modules/groups/repositories/groups.repository');

const ORGANIZATION_ID = 'organization';
const ACTOR_USER_ID = 'actor';
const GROUP_ID = 'group';
const MEMBERSHIP_ID = 'membership';

function auditingTransaction() {
  const auditRows = [];
  const group = { id: GROUP_ID, organizationId: ORGANIZATION_ID, name: 'Worship', members: [] };

  const tx = {
    organizationGroup: {
      findFirst: async () => group,
      findFirstOrThrow: async () => group,
      create: async () => group,
      update: async () => group,
      delete: async () => group,
    },
    organizationMember: {
      findMany: async ({ where }) => where.id.in.map((id) => ({ id })),
    },
    organizationGroupMember: {
      findFirst: async () => ({ groupId: GROUP_ID }),
      upsert: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    },
    auditLog: {
      create: async ({ data }) => {
        auditRows.push(data);
        return data;
      },
    },
  };

  return { prisma: { $transaction: async (callback) => callback(tx) }, auditRows };
}

test('creating a group records a CREATE audit entry', async () => {
  const { prisma, auditRows } = auditingTransaction();
  const repository = new GroupsRepository(prisma);

  await repository.create({
    organizationId: ORGANIZATION_ID,
    actorUserId: ACTOR_USER_ID,
    group: { name: 'Worship', description: null, icon: 'worship', color: '#2563EB' },
  });

  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].action, 'CREATE');
  assert.equal(auditRows[0].entityType, 'OrganizationGroup');
  assert.equal(auditRows[0].organizationId, ORGANIZATION_ID);
  assert.equal(auditRows[0].actorUserId, ACTOR_USER_ID);
});

test('updating a group records only the fields that changed', async () => {
  const { prisma, auditRows } = auditingTransaction();
  const repository = new GroupsRepository(prisma);

  await repository.update({
    organizationId: ORGANIZATION_ID,
    groupId: GROUP_ID,
    actorUserId: ACTOR_USER_ID,
    group: { name: 'Worship team', color: undefined },
  });

  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].action, 'UPDATE');
  assert.deepEqual(auditRows[0].metadata, { name: 'Worship team' });
});

test('deleting a group records a DELETE audit entry naming it', async () => {
  const { prisma, auditRows } = auditingTransaction();
  const repository = new GroupsRepository(prisma);

  await repository.delete({
    organizationId: ORGANIZATION_ID,
    groupId: GROUP_ID,
    actorUserId: ACTOR_USER_ID,
  });

  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].action, 'DELETE');
  assert.deepEqual(auditRows[0].metadata, { name: 'Worship' });
});

test('membership changes are audited against the group', async () => {
  const { prisma, auditRows } = auditingTransaction();
  const repository = new GroupsRepository(prisma);

  await repository.addMembers({
    organizationId: ORGANIZATION_ID,
    groupId: GROUP_ID,
    actorUserId: ACTOR_USER_ID,
    members: [{ membershipId: MEMBERSHIP_ID, role: 'LEADER', responsibility: 'Sound desk' }],
  });
  await repository.removeMember({
    organizationId: ORGANIZATION_ID,
    groupId: GROUP_ID,
    membershipId: MEMBERSHIP_ID,
    actorUserId: ACTOR_USER_ID,
  });

  assert.deepEqual(
    auditRows.map((row) => row.metadata),
    [{ addedMembershipIds: [MEMBERSHIP_ID] }, { removedMembershipId: MEMBERSHIP_ID }],
  );
  assert.deepEqual(
    auditRows.map((row) => row.entityId),
    [GROUP_ID, GROUP_ID],
  );
});
