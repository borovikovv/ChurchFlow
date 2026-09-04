const assert = require('node:assert/strict');
const test = require('node:test');
const { BUDGET_AUDIT_ENTITY_TYPE } = require('@churchflow/shared');
const { AuditService } = require('../dist/modules/audit/audit.service.js');

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

test('a requester without an admin membership still reads nothing', async () => {
  const { service } = auditService(null);

  await assert.rejects(list(service), {
    message: 'Only organization owners and admins can view audit logs',
  });
});
