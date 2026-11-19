const assert = require('node:assert/strict');
const test = require('node:test');
const { BadRequestException } = require('@nestjs/common');
const { GroupsService } = require('../dist/modules/groups/groups.service');
const { GroupsRepository } = require('../dist/modules/groups/repositories/groups.repository');

const ORGANIZATION_ID = 'organization-a';
const ACTOR_USER_ID = 'actor';
const PREACHERS = '11111111-1111-4111-8111-111111111111';
const MEDIA = '22222222-2222-4222-8222-222222222222';
const FOREIGN = '33333333-3333-4333-8333-333333333333';

function noRoles(overrides = {}) {
  return {
    PREACHER: [],
    SERVICE_HOST: [],
    WORSHIP_LEAD: [],
    COMMUNION_LEAD: [],
    SOUND_ENGINEER: [],
    LIVESTREAM_LEAD: [],
    ...overrides,
  };
}

/** An in-memory stand-in for the tables the service role writes touch. */
function serviceRolePrisma({ links = [], groups = [PREACHERS, MEDIA] } = {}) {
  const state = { links: links.map((link) => ({ ...link })), audit: [] };
  const matchesLink = (link, where) =>
    link.organizationId === where.organizationId &&
    (where.groupId === undefined || link.groupId === where.groupId) &&
    (where.role === undefined ||
      (typeof where.role === 'string'
        ? link.role === where.role
        : where.role.in.includes(link.role)));
  const tx = {
    organizationGroup: {
      findMany: async ({ where }) =>
        where.organizationId === ORGANIZATION_ID
          ? groups.filter((id) => where.id.in.includes(id)).map((id) => ({ id }))
          : [],
      findFirst: async ({ where }) =>
        groups.includes(where.id) && where.organizationId === ORGANIZATION_ID
          ? { id: where.id, serviceRoles: [] }
          : null,
      findFirstOrThrow: async ({ where }) => groupRecord(where.id, state.links),
      create: async ({ data }) => groupRecord(PREACHERS, state.links, data),
      update: async ({ where }) => groupRecord(where.id_organizationId.id, state.links),
    },
    organizationServiceRoleGroup: {
      findMany: async ({ where }) => state.links.filter((link) => matchesLink(link, where)),
      findFirst: async ({ where }) =>
        state.links
          .filter((link) => matchesLink(link, where))
          .sort((left, right) => right.position - left.position)[0] ?? null,
      create: async ({ data }) => state.links.push({ ...data }),
      createMany: async ({ data }) => state.links.push(...data.map((row) => ({ ...row }))),
      deleteMany: async ({ where }) => {
        state.links = state.links.filter((link) => !matchesLink(link, where));
      },
    },
    auditLog: { create: async ({ data }) => state.audit.push(data) },
  };

  return { prisma: { $transaction: async (callback) => callback(tx), ...tx }, state };
}

function groupRecord(id, links, data = {}) {
  return {
    id,
    organizationId: ORGANIZATION_ID,
    name: data.name ?? 'Preachers',
    icon: data.icon ?? 'preaching',
    color: '#C4B5FD',
    description: null,
    members: [],
    serviceRoles: links.filter((link) => link.groupId === id).map(({ role }) => ({ role })),
  };
}

test('replacing the role groups stores every role in the order given', async () => {
  const { prisma, state } = serviceRolePrisma({
    links: [{ organizationId: ORGANIZATION_ID, role: 'PREACHER', groupId: MEDIA, position: 0 }],
  });
  const service = new GroupsService(new GroupsRepository(prisma));

  const result = await service.replaceServiceRoleGroups(
    ORGANIZATION_ID,
    { roles: noRoles({ PREACHER: [PREACHERS], SOUND_ENGINEER: [MEDIA, PREACHERS] }) },
    ACTOR_USER_ID,
  );

  assert.deepEqual(
    result.roles,
    noRoles({ PREACHER: [PREACHERS], SOUND_ENGINEER: [MEDIA, PREACHERS] }),
  );
  assert.deepEqual(
    state.links.map(({ role, groupId, position }) => [role, groupId, position]),
    [
      ['PREACHER', PREACHERS, 0],
      ['SOUND_ENGINEER', MEDIA, 0],
      ['SOUND_ENGINEER', PREACHERS, 1],
    ],
  );
  assert.equal(state.audit[0].entityType, 'ServiceRoleGroups');
});

test('a group of another organization is refused and nothing is written', async () => {
  const links = [
    { organizationId: ORGANIZATION_ID, role: 'PREACHER', groupId: PREACHERS, position: 0 },
  ];
  const { prisma, state } = serviceRolePrisma({ links });
  const service = new GroupsService(new GroupsRepository(prisma));

  await assert.rejects(
    service.replaceServiceRoleGroups(
      ORGANIZATION_ID,
      { roles: noRoles({ PREACHER: [FOREIGN] }) },
      ACTOR_USER_ID,
    ),
    BadRequestException,
  );
  assert.deepEqual(state.links, links);
  assert.equal(state.audit.length, 0);
});

test('a group linked from its form is appended after the groups the role already has', async () => {
  const { prisma, state } = serviceRolePrisma({
    links: [
      { organizationId: ORGANIZATION_ID, role: 'SOUND_ENGINEER', groupId: MEDIA, position: 0 },
    ],
  });
  const service = new GroupsService(new GroupsRepository(prisma));

  const group = await service.update(
    ORGANIZATION_ID,
    PREACHERS,
    { serviceRoles: ['SOUND_ENGINEER', 'PREACHER'] },
    ACTOR_USER_ID,
  );

  assert.deepEqual(group.serviceRoles, ['PREACHER', 'SOUND_ENGINEER']);
  const sound = state.links.filter((link) => link.role === 'SOUND_ENGINEER');
  assert.deepEqual(
    sound.map(({ groupId, position }) => [groupId, position]),
    [
      [MEDIA, 0],
      [PREACHERS, 1],
    ],
  );
});

test('unticking a role in the group form removes only that link', async () => {
  const { prisma, state } = serviceRolePrisma({
    links: [
      { organizationId: ORGANIZATION_ID, role: 'PREACHER', groupId: PREACHERS, position: 0 },
      { organizationId: ORGANIZATION_ID, role: 'SERVICE_HOST', groupId: PREACHERS, position: 0 },
      { organizationId: ORGANIZATION_ID, role: 'PREACHER', groupId: MEDIA, position: 1 },
    ],
  });
  const service = new GroupsService(new GroupsRepository(prisma));

  await service.update(ORGANIZATION_ID, PREACHERS, { serviceRoles: ['PREACHER'] }, ACTOR_USER_ID);

  assert.deepEqual(
    state.links.map(({ role, groupId }) => [role, groupId]),
    [
      ['PREACHER', PREACHERS],
      ['PREACHER', MEDIA],
    ],
  );
});

test('creating a group links it to the roles ticked in its form', async () => {
  const { prisma, state } = serviceRolePrisma();
  const service = new GroupsService(new GroupsRepository(prisma));

  const group = await service.create(
    ORGANIZATION_ID,
    {
      name: 'Preachers',
      description: null,
      icon: 'preaching',
      color: '#C4B5FD',
      serviceRoles: ['PREACHER'],
    },
    ACTOR_USER_ID,
  );

  assert.deepEqual(group.serviceRoles, ['PREACHER']);
  assert.deepEqual(state.audit[0].metadata.serviceRoles, ['PREACHER']);
});
