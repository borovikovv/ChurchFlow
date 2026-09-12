const assert = require('node:assert/strict');
const test = require('node:test');
const { BUDGET_AUDIT_ENTITY_TYPE } = require('@churchflow/shared');
const { AuditService } = require('../dist/modules/audit/audit.service.js');
const { AuditRepository } = require('../dist/modules/audit/repositories/audit.repository.js');

const ORGANIZATION_ID = 'org-1';
const ACTOR_USER_ID = 'user-1';

function auditService(role) {
  const queries = [];
  const repository = {
    findOrganizationManager: async () => (role ? { id: 'membership', role } : null),
    listForOrganization: async (input) => {
      queries.push(input);
      return [];
    },
  };

  return { service: new AuditService(repository), queries };
}

function list(service, query = {}) {
  return service.listForOrganization(ORGANIZATION_ID, ACTOR_USER_ID, { limit: 10, ...query });
}

test('an owner reads the whole feed, budget history included', async () => {
  const { service, queries } = auditService('OWNER');

  await list(service);
  assert.equal(queries[0].excludedEntityTypes, undefined);

  await list(service, { entityType: BUDGET_AUDIT_ENTITY_TYPE });
  assert.equal(queries[1].entityType, BUDGET_AUDIT_ENTITY_TYPE);
});

test('an admin never sees budget history in the feed', async () => {
  const { service, queries } = auditService('ADMIN');

  await list(service);

  assert.deepEqual(queries[0].excludedEntityTypes, [BUDGET_AUDIT_ENTITY_TYPE]);
});

test('an admin cannot ask for budget history directly', async () => {
  const { service, queries } = auditService('ADMIN');

  await assert.rejects(list(service, { entityType: BUDGET_AUDIT_ENTITY_TYPE }), {
    message: 'Only organization owners can view budget audit logs',
  });
  assert.equal(queries.length, 0);
});

test('the next cursor is the last row kept, so the repository skip drops nothing', async () => {
  const rows = Array.from({ length: 4 }, (unused, index) => ({
    id: `log-${String(index)}`,
    organizationId: ORGANIZATION_ID,
    actorUserId: ACTOR_USER_ID,
    action: 'UPDATE',
    entityType: 'Organization',
    entityId: null,
    metadata: {},
    createdAt: new Date(0),
    actor: null,
  }));
  const repository = {
    findOrganizationManager: async () => ({ id: 'membership', role: 'OWNER' }),
    listForOrganization: async (input) => rows.slice(0, input.limit + 1),
  };

  const page = await new AuditService(repository).listForOrganization(
    ORGANIZATION_ID,
    ACTOR_USER_ID,
    { limit: 3 },
  );

  assert.deepEqual(
    page.items.map((item) => item.id),
    ['log-0', 'log-1', 'log-2'],
  );
  assert.equal(page.nextCursor, 'log-2');

  const lastPage = await new AuditService({
    ...repository,
    listForOrganization: async () => rows.slice(0, 3),
  }).listForOrganization(ORGANIZATION_ID, ACTOR_USER_ID, { limit: 3 });
  assert.equal(lastPage.nextCursor, null);
});

test('a requester without an admin membership still reads nothing', async () => {
  const { service } = auditService(null);

  await assert.rejects(list(service), {
    message: 'Only organization owners and admins can view audit logs',
  });
});

for (const { role, entityType, expectedWhere } of [
  {
    role: 'ADMIN',
    entityType: 'OrganizationMember',
    expectedWhere: {
      organizationId: ORGANIZATION_ID,
      entityType: 'OrganizationMember',
      AND: [{ entityType: { notIn: [BUDGET_AUDIT_ENTITY_TYPE] } }],
    },
  },
  {
    role: 'ADMIN',
    entityType: undefined,
    expectedWhere: {
      organizationId: ORGANIZATION_ID,
      AND: [{ entityType: { notIn: [BUDGET_AUDIT_ENTITY_TYPE] } }],
    },
  },
  {
    role: 'OWNER',
    entityType: BUDGET_AUDIT_ENTITY_TYPE,
    expectedWhere: {
      organizationId: ORGANIZATION_ID,
      entityType: BUDGET_AUDIT_ENTITY_TYPE,
    },
  },
  {
    role: 'OWNER',
    entityType: undefined,
    expectedWhere: { organizationId: ORGANIZATION_ID },
  },
]) {
  test(`${role} feed preserves ${entityType ?? 'all types'} and visibility constraints in the database query`, async () => {
    const queries = [];
    const repository = new AuditRepository({
      organizationMember: {
        findFirst: async () => ({ id: 'membership', role }),
      },
      auditLog: {
        findMany: async (query) => {
          queries.push(query);
          return [];
        },
      },
    });

    await list(new AuditService(repository), { entityType });

    assert.equal(queries.length, 1);
    assert.deepEqual(queries[0].where, expectedWhere);
  });
}
