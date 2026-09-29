const assert = require('node:assert/strict');
const test = require('node:test');
const { BadRequestException } = require('@nestjs/common');
const { GroupsRepository } = require('../dist/modules/groups/repositories/groups.repository');
const { GroupsService } = require('../dist/modules/groups/groups.service');

const ORGANIZATION_ID = 'organization-a';
const OTHER_ORGANIZATION_ID = 'organization-b';
const ACTOR_USER_ID = 'actor';
const GROUP_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_GROUP_ID = '22222222-2222-4222-8222-222222222222';

function membership(id, overrides = {}) {
  return {
    id,
    organizationId: ORGANIZATION_ID,
    role: 'MEMBER',
    status: 'ACTIVE',
    removedAt: null,
    grouped: false,
    profile: { displayName: id, profilePhotoAsset: null },
    user: null,
    ...overrides,
  };
}

function matchesMembership(row, where) {
  if (row.organizationId !== where.organizationId) return false;
  if (where.removedAt === null && row.removedAt !== null) return false;
  if (where.status?.in && !where.status.in.includes(row.status)) return false;
  if (typeof where.role === 'string' && row.role !== where.role) return false;
  if (where.role?.not && row.role === where.role.not) return false;
  if (where.groups?.none && row.grouped) return false;
  return true;
}

function boardPrisma({ memberships = [], groups = [], layout = [] } = {}) {
  return {
    organizationMember: {
      findMany: async ({ where }) => memberships.filter((row) => matchesMembership(row, where)),
      findFirst: async () => ({ id: 'actor-membership', role: 'OWNER', permissions: [] }),
    },
    organizationGroup: { findMany: async () => groups },
    organizationGroupBoardNode: {
      findMany: async ({ where }) =>
        layout.filter((row) => row.organizationId === where.organizationId),
    },
  };
}

test('the board lists ungrouped people apart from ungrouped visitors', async () => {
  const service = new GroupsService(
    new GroupsRepository(
      boardPrisma({
        memberships: [
          membership('member'),
          membership('admin', { role: 'ADMIN' }),
          membership('suspended', { status: 'SUSPENDED' }),
          membership('grouped-member', { grouped: true }),
          membership('removed-member', { status: 'REMOVED', removedAt: new Date() }),
          membership('visitor', { role: 'VIEWER' }),
          membership('grouped-visitor', { role: 'VIEWER', grouped: true }),
          membership('removed-visitor', { role: 'VIEWER', removedAt: new Date() }),
          membership('foreign', { organizationId: OTHER_ORGANIZATION_ID }),
        ],
      }),
    ),
  );

  const board = await service.getBoard(ORGANIZATION_ID, ACTOR_USER_ID);

  assert.deepEqual(
    board.unassignedMembers.map((person) => person.membershipId),
    ['member', 'admin', 'suspended'],
  );
  assert.deepEqual(
    board.visitors.map((person) => person.membershipId),
    ['visitor'],
  );
  assert.equal(board.canManage, true);
});

test('the board lists leaders before members in every group', async () => {
  const member = (id, role) => ({
    membershipId: id,
    role,
    responsibility: null,
    membership: { id, profile: { displayName: id, profilePhotoAsset: null }, user: null },
  });
  const service = new GroupsService(
    new GroupsRepository(
      boardPrisma({
        groups: [
          {
            id: GROUP_ID,
            organizationId: ORGANIZATION_ID,
            name: 'Worship',
            icon: 'worship',
            color: '#2563EB',
            description: null,
            members: [member('a', 'MEMBER'), member('b', 'LEADER'), member('c', 'MEMBER')],
          },
        ],
      }),
    ),
  );

  const board = await service.getBoard(ORGANIZATION_ID, ACTOR_USER_ID);

  assert.deepEqual(
    board.groups[0].members.map((item) => item.membershipId),
    ['b', 'a', 'c'],
  );
});

test('the board returns only the layout of its own organization', async () => {
  const service = new GroupsService(
    new GroupsRepository(
      boardPrisma({
        layout: [
          { organizationId: ORGANIZATION_ID, nodeKey: GROUP_ID, x: 10, y: 20 },
          { organizationId: OTHER_ORGANIZATION_ID, nodeKey: OTHER_GROUP_ID, x: 0, y: 0 },
        ],
      }),
    ),
  );

  const board = await service.getBoard(ORGANIZATION_ID, ACTOR_USER_ID);

  assert.deepEqual(
    board.layout.map((node) => node.nodeKey),
    [GROUP_ID],
  );
});

function layoutTransaction(groupRows) {
  const upserts = [];
  const tx = {
    organizationGroup: {
      findMany: async ({ where }) =>
        groupRows.filter(
          (row) => where.id.in.includes(row.id) && row.organizationId === where.organizationId,
        ),
    },
    organizationGroupBoardNode: {
      upsert: async (args) => {
        upserts.push(args);
        return {};
      },
    },
  };

  return { prisma: { $transaction: async (callback) => callback(tx) }, upserts };
}

test('saving the layout stores every node against the organization', async () => {
  const { prisma, upserts } = layoutTransaction([
    { id: GROUP_ID, organizationId: ORGANIZATION_ID },
  ]);
  const service = new GroupsService(new GroupsRepository(prisma));

  await service.saveBoardLayout(
    ORGANIZATION_ID,
    {
      nodes: [
        { nodeKey: GROUP_ID, x: 10, y: 20 },
        { nodeKey: 'unassigned', x: -300, y: 0 },
        { nodeKey: 'visitors', x: -300, y: 400 },
      ],
    },
    ACTOR_USER_ID,
  );

  assert.deepEqual(
    upserts.map((args) => args.where.organizationId_nodeKey),
    [
      { organizationId: ORGANIZATION_ID, nodeKey: GROUP_ID },
      { organizationId: ORGANIZATION_ID, nodeKey: 'unassigned' },
      { organizationId: ORGANIZATION_ID, nodeKey: 'visitors' },
    ],
  );
  assert.ok(upserts.every((args) => args.create.organizationId === ORGANIZATION_ID));
  assert.ok(upserts.every((args) => args.update.updatedByUserId === ACTOR_USER_ID));
});

test('saving the layout of a group of another organization is refused', async () => {
  const { prisma, upserts } = layoutTransaction([
    { id: GROUP_ID, organizationId: ORGANIZATION_ID },
    { id: OTHER_GROUP_ID, organizationId: OTHER_ORGANIZATION_ID },
  ]);
  const service = new GroupsService(new GroupsRepository(prisma));

  await assert.rejects(
    service.saveBoardLayout(
      ORGANIZATION_ID,
      {
        nodes: [
          { nodeKey: GROUP_ID, x: 0, y: 0 },
          { nodeKey: OTHER_GROUP_ID, x: 0, y: 0 },
        ],
      },
      ACTOR_USER_ID,
    ),
    (error) => error instanceof BadRequestException,
  );
  assert.deepEqual(upserts, []);
});

test('saving the layout of an unknown group is refused', async () => {
  const { prisma, upserts } = layoutTransaction([]);
  const service = new GroupsService(new GroupsRepository(prisma));

  await assert.rejects(
    service.saveBoardLayout(
      ORGANIZATION_ID,
      { nodes: [{ nodeKey: GROUP_ID, x: 0, y: 0 }] },
      ACTOR_USER_ID,
    ),
    (error) => error instanceof BadRequestException,
  );
  assert.deepEqual(upserts, []);
});

test('deleting a group removes its board position with it', async () => {
  const deletedNodes = [];
  const tx = {
    organizationGroup: {
      findFirst: async () => ({ id: GROUP_ID, name: 'Worship' }),
      delete: async () => ({}),
    },
    organizationGroupBoardNode: {
      deleteMany: async ({ where }) => {
        deletedNodes.push(where);
        return { count: 1 };
      },
    },
    auditLog: { create: async () => ({}) },
  };
  const repository = new GroupsRepository({ $transaction: async (callback) => callback(tx) });

  await repository.delete({
    organizationId: ORGANIZATION_ID,
    groupId: GROUP_ID,
    actorUserId: ACTOR_USER_ID,
  });

  assert.deepEqual(deletedNodes, [{ organizationId: ORGANIZATION_ID, nodeKey: GROUP_ID }]);
});
