require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { Reflector } = require('@nestjs/core');
const { ForbiddenException, NotFoundException } = require('@nestjs/common');
const {
  KnowledgeEntriesRepository,
} = require('../dist/modules/knowledge/repositories/knowledge-entries.repository');
const {
  ImportantDatesRepository,
} = require('../dist/modules/knowledge/repositories/important-dates.repository');
const { KnowledgeEntriesService } = require('../dist/modules/knowledge/knowledge-entries.service');
const { ImportantDatesService } = require('../dist/modules/knowledge/important-dates.service');
const {
  KnowledgeEntriesController,
} = require('../dist/modules/knowledge/knowledge-entries.controller');
const {
  ImportantDatesController,
} = require('../dist/modules/knowledge/important-dates.controller');
const { OrganizationAccessGuard } = require('../dist/common/guards/organization-access.guard');

const ORG = 'organization-a';
const OTHER_ORG = 'organization-b';
const USER = 'user-1';

function entry(id, overrides = {}) {
  return {
    id,
    organizationId: ORG,
    title: id,
    content: `<p>${id}</p>`,
    category: 'OTHER',
    tags: [],
    pinned: false,
    visibility: 'MEMBERS',
    createdById: USER,
    updatedById: USER,
    createdBy: { id: USER, displayName: 'Anna', email: null },
    updatedBy: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-02T00:00:00.000Z'),
    ...overrides,
  };
}

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return true;
    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value.in)) return value.in.includes(row[key]);
      if ('has' in value) return row[key].includes(value.has);
      return true;
    }
    return row[key] === value;
  });
}

/** A Prisma fake that applies the where clauses the repositories build, so filters are visible. */
function createPrisma({
  role = 'MEMBER',
  permissions = [],
  platformRole = 'USER',
  rows = [],
} = {}) {
  const writes = [];
  const queries = [];
  const table = (name) => ({
    findMany: async (args) => {
      queries.push({ table: name, operation: 'findMany', where: args.where });
      return rows.filter((row) => matches(row, args.where));
    },
    findFirst: async (args) => {
      queries.push({ table: name, operation: 'findFirst', where: args.where });
      return rows.find((row) => matches(row, args.where)) ?? null;
    },
    create: async (args) => {
      writes.push({ table: name, operation: 'create', data: args.data });
      return entry('created', { ...args.data, createdBy: null, updatedBy: null });
    },
    update: async (args) => {
      writes.push({ table: name, operation: 'update', where: args.where, data: args.data });
      return entry(args.where.id, { ...args.data, createdBy: null, updatedBy: null });
    },
    delete: async (args) => {
      writes.push({ table: name, operation: 'delete', where: args.where });
      return { id: args.where.id };
    },
  });
  const prisma = {
    user: {
      findUnique: async ({ select }) => {
        const membershipOrg = select.memberships.where.organizationId;
        return {
          platformRole,
          deletedAt: null,
          memberships: role && membershipOrg === ORG ? [{ role, permissions }] : [],
        };
      },
    },
    organization: { findFirst: async ({ where }) => (where.id === ORG ? { id: ORG } : null) },
    knowledgeEntry: table('knowledgeEntry'),
    importantDate: table('importantDate'),
    auditLog: {
      create: async (args) => {
        writes.push({ table: 'auditLog', operation: 'create', data: args.data });
      },
    },
  };
  prisma.$transaction = async (callback) => callback(prisma);

  return { prisma, writes, queries };
}

function entriesService(options) {
  const fake = createPrisma(options);
  return {
    ...fake,
    service: new KnowledgeEntriesService(new KnowledgeEntriesRepository(fake.prisma), fake.prisma),
  };
}

function datesService(options) {
  const fake = createPrisma(options);
  return {
    ...fake,
    service: new ImportantDatesService(new ImportantDatesRepository(fake.prisma), fake.prisma),
  };
}

const VISIBILITY_ROWS = [
  entry('for-members'),
  entry('for-admins', { visibility: 'ADMINS' }),
  entry('for-owner', { visibility: 'OWNER' }),
];

async function visibleTitles(options) {
  const { service } = entriesService({ ...options, rows: VISIBILITY_ROWS });
  const payload = await service.list(ORG, USER, {});
  return payload.items.map((item) => item.title).sort();
}

test('every member, viewers included, reads only what is shared with all members', async () => {
  assert.deepEqual(await visibleTitles({ role: 'VIEWER' }), ['for-members']);
  assert.deepEqual(await visibleTitles({ role: 'MEMBER' }), ['for-members']);
});

test('admins and knowledge.manage holders also read admin entries, but not owner ones', async () => {
  assert.deepEqual(await visibleTitles({ role: 'ADMIN' }), ['for-admins', 'for-members']);
  assert.deepEqual(await visibleTitles({ role: 'MEMBER', permissions: ['knowledge.manage'] }), [
    'for-admins',
    'for-members',
  ]);
});

test('the owner and platform admins read everything', async () => {
  assert.deepEqual(await visibleTitles({ role: 'OWNER' }), [
    'for-admins',
    'for-members',
    'for-owner',
  ]);
  assert.deepEqual(await visibleTitles({ role: null, platformRole: 'ADMIN' }), [
    'for-admins',
    'for-members',
    'for-owner',
  ]);
});

test('the visibility filter is applied in the query, with the organization from the route', async () => {
  const { service, queries } = entriesService({ role: 'MEMBER', rows: VISIBILITY_ROWS });
  await service.list(ORG, USER, { q: 'Communion', tag: 'kids', category: 'TRADITION' });

  const list = queries.find((query) => query.operation === 'findMany' && query.where.OR);
  assert.equal(list.where.organizationId, ORG);
  assert.deepEqual(list.where.visibility, { in: ['MEMBERS'] });
  assert.equal(list.where.category, 'TRADITION');
  assert.deepEqual(list.where.tags, { has: 'kids' });
  assert.deepEqual(list.where.OR, [
    { title: { contains: 'Communion', mode: 'insensitive' } },
    { content: { contains: 'Communion', mode: 'insensitive' } },
    { tags: { has: 'communion' } },
  ]);
});

test('an entry the user may not see is not found, as is one from another organization', async () => {
  const { service } = entriesService({
    role: 'ADMIN',
    rows: [...VISIBILITY_ROWS, entry('elsewhere', { organizationId: OTHER_ORG })],
  });

  assert.equal((await service.get(ORG, 'for-admins', USER)).title, 'for-admins');
  await assert.rejects(() => service.get(ORG, 'for-owner', USER), NotFoundException);
  await assert.rejects(() => service.get(ORG, 'elsewhere', USER), NotFoundException);
});

test('someone without a membership in the organization is refused', async () => {
  const { service } = entriesService({ role: 'OWNER', rows: VISIBILITY_ROWS });

  await assert.rejects(() => service.list(OTHER_ORG, USER, {}), ForbiddenException);
});

const NOTE = {
  title: 'Communion',
  content: '<p>First Sunday</p><script>alert(1)</script>',
  category: 'TRADITION',
  tags: ['communion'],
  pinned: false,
  visibility: 'MEMBERS',
};

test('a plain member cannot write knowledge', async () => {
  const { service, writes } = entriesService({ role: 'MEMBER' });

  await assert.rejects(() => service.create(ORG, NOTE, USER), ForbiddenException);
  assert.deepEqual(writes, []);
});

test('a member with knowledge.manage writes sanitized content, audited, as themselves', async () => {
  const { service, writes } = entriesService({ role: 'MEMBER', permissions: ['knowledge.manage'] });

  await service.create(ORG, NOTE, USER);

  const created = writes.find((write) => write.table === 'knowledgeEntry');
  assert.equal(created.data.organizationId, ORG);
  assert.equal(created.data.createdById, USER);
  assert.equal(created.data.updatedById, USER);
  assert.equal(created.data.content, '<p>First Sunday</p>');
  const audit = writes.find((write) => write.table === 'auditLog');
  assert.equal(audit.data.action, 'CREATE_KNOWLEDGE_ENTRY');
  assert.equal(audit.data.entityType, 'KnowledgeEntry');
});

test('content that sanitizes to nothing is refused', async () => {
  const { service } = entriesService({ role: 'OWNER' });

  await assert.rejects(
    () => service.create(ORG, { ...NOTE, content: '<script>alert(1)</script>' }, USER),
    (error) => error.getStatus() === 400,
  );
});

test('a writer cannot hide an entry from themselves', async () => {
  const { service } = entriesService({ role: 'ADMIN' });

  await assert.rejects(
    () => service.create(ORG, { ...NOTE, visibility: 'OWNER' }, USER),
    ForbiddenException,
  );
  await service.create(ORG, { ...NOTE, visibility: 'ADMINS' }, USER);
});

test('an admin cannot change or delete an owner-only entry', async () => {
  const { service, writes } = entriesService({ role: 'ADMIN', rows: VISIBILITY_ROWS });

  await assert.rejects(
    () => service.update(ORG, 'for-owner', { pinned: true }, USER),
    NotFoundException,
  );
  await assert.rejects(() => service.delete(ORG, 'for-owner', USER), NotFoundException);
  assert.deepEqual(writes, []);

  await service.update(ORG, 'for-admins', { pinned: true }, USER);
  assert.deepEqual(writes[0].data, { pinned: true, updatedById: USER });
});

test('important dates follow the same visibility and come soonest first', async () => {
  const dates = [
    entry('christmas', { ruleKind: 'FIXED', month: 12, day: 25, weekday: null, nth: null }),
    entry('thanksgiving', { ruleKind: 'NTH_WEEKDAY', month: 10, day: null, weekday: 0, nth: 1 }),
    entry('owner-day', {
      ruleKind: 'FIXED',
      month: 11,
      day: 1,
      weekday: null,
      nth: null,
      visibility: 'OWNER',
    }),
  ];
  const { service } = datesService({ role: 'MEMBER', rows: dates });

  const payload = await service.list(ORG, USER, {}, '2026-10-01');

  assert.equal(payload.canManage, false);
  assert.deepEqual(payload.assignableVisibilities, []);
  assert.deepEqual(
    payload.items.map((item) => [item.title, item.nextDate]),
    [
      ['thanksgiving', '2026-10-04'],
      ['christmas', '2026-12-25'],
    ],
  );
});

test('switching a date to a fixed day clears the weekday rule it no longer uses', async () => {
  const { service, writes } = datesService({
    role: 'OWNER',
    rows: [entry('thanksgiving', { ruleKind: 'NTH_WEEKDAY', month: 10, weekday: 0, nth: 1 })],
  });

  await service.update(ORG, 'thanksgiving', { ruleKind: 'FIXED', month: 10, day: 12 }, USER);

  const update = writes.find((write) => write.table === 'importantDate');
  assert.deepEqual(update.data, {
    ruleKind: 'FIXED',
    month: 10,
    day: 12,
    weekday: null,
    nth: null,
    updatedById: USER,
  });
});

const reflector = new Reflector();

test('knowledge writes require knowledge.manage on the route; reads require only membership', () => {
  for (const controller of [KnowledgeEntriesController, ImportantDatesController]) {
    for (const handler of ['create', 'update', 'delete']) {
      assert.equal(
        reflector.get('organizationPermission', controller.prototype[handler]),
        'knowledge.manage',
        `${controller.name}.${handler}`,
      );
    }
    for (const handler of ['list', 'get']) {
      assert.equal(
        reflector.get('organizationPermission', controller.prototype[handler]),
        undefined,
      );
    }
  }
});

function routeContext(handler, organizationId) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ auth: { userId: USER }, params: { organizationId } }),
    }),
    getHandler: () => handler,
    getClass: () => KnowledgeEntriesController,
  };
}

test('the guard lets owners, admins and knowledge.manage holders write, and no one else', async () => {
  const create = KnowledgeEntriesController.prototype.create;
  const allowed = [
    { role: 'OWNER' },
    { role: 'ADMIN' },
    { role: 'MEMBER', permissions: ['knowledge.manage'] },
    { role: null, platformRole: 'SUPER_ADMIN' },
  ];
  for (const options of allowed) {
    const guard = new OrganizationAccessGuard(createPrisma(options).prisma, reflector);
    assert.equal(await guard.canActivate(routeContext(create, ORG)), true, JSON.stringify(options));
  }

  for (const options of [
    { role: 'MEMBER' },
    { role: 'VIEWER' },
    { role: 'MEMBER', permissions: ['members.manage'] },
  ]) {
    const guard = new OrganizationAccessGuard(createPrisma(options).prisma, reflector);
    await assert.rejects(() => guard.canActivate(routeContext(create, ORG)), ForbiddenException);
  }

  const owner = new OrganizationAccessGuard(createPrisma({ role: 'OWNER' }).prisma, reflector);
  await assert.rejects(
    () => owner.canActivate(routeContext(KnowledgeEntriesController.prototype.list, OTHER_ORG)),
    ForbiddenException,
  );
});

const DATE = {
  title: 'Church anniversary',
  notes: null,
  ruleKind: 'FIXED',
  month: 5,
  day: 12,
  weekday: null,
  nth: null,
  reminderLeadDays: null,
  visibility: 'MEMBERS',
};
const FIXED_RULE = { ruleKind: 'FIXED', month: 5, day: 12, weekday: null, nth: null };
const DATE_VISIBILITY_ROWS = [
  entry('for-members', FIXED_RULE),
  entry('for-admins', { ...FIXED_RULE, visibility: 'ADMINS' }),
  entry('for-owner', { ...FIXED_RULE, visibility: 'OWNER' }),
];
const KNOWLEDGE_MANAGER = { role: 'MEMBER', permissions: ['knowledge.manage'] };

test('a knowledge.manage holder cannot create an owner-only note or date', async () => {
  const notes = entriesService(KNOWLEDGE_MANAGER);
  await assert.rejects(
    () => notes.service.create(ORG, { ...NOTE, visibility: 'OWNER' }, USER),
    ForbiddenException,
  );

  const dates = datesService(KNOWLEDGE_MANAGER);
  await assert.rejects(
    () => dates.service.create(ORG, { ...DATE, visibility: 'OWNER' }, USER),
    ForbiddenException,
  );

  assert.deepEqual([...notes.writes, ...dates.writes], []);
});

test('a writer cannot raise a note they can see to owner-only', async () => {
  for (const writer of [{ role: 'ADMIN' }, KNOWLEDGE_MANAGER]) {
    const { service, writes } = entriesService({ ...writer, rows: VISIBILITY_ROWS });

    for (const id of ['for-members', 'for-admins']) {
      await assert.rejects(
        () => service.update(ORG, id, { visibility: 'OWNER' }, USER),
        ForbiddenException,
        `${JSON.stringify(writer)} ${id}`,
      );
    }
    assert.deepEqual(writes, [], JSON.stringify(writer));
  }
});

test('a writer cannot raise a date they can see to owner-only', async () => {
  for (const writer of [{ role: 'ADMIN' }, KNOWLEDGE_MANAGER]) {
    const { service, writes } = datesService({ ...writer, rows: DATE_VISIBILITY_ROWS });

    for (const id of ['for-members', 'for-admins']) {
      await assert.rejects(
        () => service.update(ORG, id, { visibility: 'OWNER' }, USER),
        ForbiddenException,
        `${JSON.stringify(writer)} ${id}`,
      );
    }
    assert.deepEqual(writes, [], JSON.stringify(writer));
  }
});

test('a plain member cannot raise visibility either, even on a note shared with them', async () => {
  const { service, writes } = entriesService({ role: 'MEMBER', rows: VISIBILITY_ROWS });

  await assert.rejects(
    () => service.update(ORG, 'for-members', { visibility: 'ADMINS' }, USER),
    ForbiddenException,
  );
  assert.deepEqual(writes, []);
});

test('only knowledge writers create and delete important dates', async () => {
  for (const reader of [{ role: 'MEMBER' }, { role: 'VIEWER' }]) {
    const { service, writes } = datesService({ ...reader, rows: DATE_VISIBILITY_ROWS });

    await assert.rejects(() => service.create(ORG, DATE, USER), ForbiddenException, reader.role);
    await assert.rejects(
      () => service.delete(ORG, 'for-members', USER),
      ForbiddenException,
      reader.role,
    );
    assert.deepEqual(writes, [], reader.role);
  }

  for (const writer of [{ role: 'OWNER' }, { role: 'ADMIN' }, KNOWLEDGE_MANAGER]) {
    const { service, writes } = datesService({ ...writer, rows: DATE_VISIBILITY_ROWS });

    await service.create(ORG, DATE, USER);
    await service.delete(ORG, 'for-members', USER);
    assert.deepEqual(
      writes.filter((write) => write.table === 'importantDate').map((write) => write.operation),
      ['create', 'delete'],
      JSON.stringify(writer),
    );
  }
});

test('a date above the writer is neither changed nor deleted, as if it did not exist', async () => {
  for (const writer of [{ role: 'ADMIN' }, KNOWLEDGE_MANAGER]) {
    const { service, writes } = datesService({ ...writer, rows: DATE_VISIBILITY_ROWS });

    await assert.rejects(
      () => service.update(ORG, 'for-owner', { title: 'Renamed' }, USER),
      NotFoundException,
    );
    await assert.rejects(() => service.delete(ORG, 'for-owner', USER), NotFoundException);
    assert.deepEqual(writes, [], JSON.stringify(writer));
  }
});
