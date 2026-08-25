const assert = require('node:assert/strict');
const test = require('node:test');
const { Prisma } = require('@churchflow/db');
const {
  OrganizationsService,
} = require('../dist/modules/organizations/organizations.service');
const {
  OrganizationRequestsRepository,
} = require('../dist/modules/organization-requests/repositories/organization-requests.repository');

const ORGANIZATION_ID = 'organization';
const ACTOR_USER_ID = 'actor';
const SLUG = 'grace';

function prismaError(code) {
  return new Prisma.PrismaClientKnownRequestError('failed', { code, clientVersion: 'test' });
}

function requestsRepository(rows) {
  return new OrganizationRequestsRepository({
    organization: {
      findFirst: async ({ where }) =>
        rows.find((row) => row.slug === where.slug && row.deletedAt === where.deletedAt) ?? null,
    },
  });
}

test('a slug held by a deleted organization counts as free', async () => {
  const repository = requestsRepository([
    { id: ORGANIZATION_ID, slug: SLUG, deletedAt: new Date() },
  ]);

  assert.equal(await repository.findOrganizationBySlug(SLUG), null);
});

test('a slug held by a live organization is still taken', async () => {
  const repository = requestsRepository([{ id: ORGANIZATION_ID, slug: SLUG, deletedAt: null }]);

  assert.deepEqual(await repository.findOrganizationBySlug(SLUG), {
    id: ORGANIZATION_ID,
    slug: SLUG,
    deletedAt: null,
  });
});

function serviceThatFails(error) {
  return new OrganizationsService(
    { changeStatus: async () => Promise.reject(error) },
    {},
    { record: async () => undefined },
  );
}

test('restoring into a slug somebody else took reports a conflict', async () => {
  const service = serviceThatFails(prismaError('P2002'));

  await assert.rejects(service.restore(ORGANIZATION_ID, ACTOR_USER_ID), (error) => {
    assert.equal(error.getStatus(), 409);
    return true;
  });
});

test('a missing organization is still a not found, not a conflict', async () => {
  const service = serviceThatFails(prismaError('P2025'));

  await assert.rejects(service.restore(ORGANIZATION_ID, ACTOR_USER_ID), (error) => {
    assert.equal(error.getStatus(), 404);
    return true;
  });
});

test('a uniqueness failure on any other action is not disguised as a slug conflict', async () => {
  const service = serviceThatFails(prismaError('P2002'));

  await assert.rejects(
    service.archive(ORGANIZATION_ID, ACTOR_USER_ID),
    (error) => error instanceof Prisma.PrismaClientKnownRequestError,
  );
});
