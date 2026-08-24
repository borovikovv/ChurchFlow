const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MembershipsRepository,
} = require('../dist/modules/memberships/repositories/memberships.repository');
const {
  PrayerRequestsRepository,
} = require('../dist/modules/prayer-requests/repositories/prayer-requests.repository');

const ACTOR = { membershipId: 'membership', role: 'OWNER', userId: 'user' };

function rowsNamed(count, prefix) {
  return Array.from({ length: count }, (unused, index) => ({ id: `${prefix}-${String(index)}` }));
}

function prayerRepository({ total, rows }) {
  const calls = [];
  const prisma = {
    prayerRequest: {
      count: async () => total,
      findMany: async (args) => {
        calls.push(args);
        return rows;
      },
    },
  };

  return { repository: new PrayerRequestsRepository(prisma), calls };
}

function membershipsRepository({ total, rows }) {
  const calls = [];
  const prisma = {
    organizationMember: {
      count: async () => total,
      findMany: async (args) => {
        calls.push(args);
        // The page query runs first, the member-candidate lookup second.
        return calls.length === 1 ? rows : [];
      },
    },
  };

  return { repository: new MembershipsRepository(prisma), calls };
}

function listRequests(repository, { page = 1, pageSize = 3, cursor } = {}) {
  return repository.listForOrganization({
    organizationId: 'organization',
    actor: ACTOR,
    tab: 'active',
    page,
    pageSize,
    ...(cursor ? { cursor } : {}),
  });
}

function listMembers(repository, { page = 1, pageSize = 3, cursor } = {}) {
  return repository.listForOrganization(
    'organization',
    'all',
    'active',
    'all',
    '',
    [],
    page,
    pageSize,
    undefined,
    cursor,
  );
}

test('prayer requests over-fetch one row and return the last kept id as the cursor', async () => {
  const { repository, calls } = prayerRepository({ total: 12, rows: rowsNamed(4, 'request') });

  const page = await listRequests(repository);

  assert.equal(calls[0].take, 4);
  assert.deepEqual(
    page.items.map((item) => item.id),
    ['request-0', 'request-1', 'request-2'],
  );
  assert.equal(page.nextCursor, 'request-2');
});

test('members over-fetch one row and return the last kept id as the cursor', async () => {
  const { repository, calls } = membershipsRepository({ total: 12, rows: rowsNamed(4, 'member') });

  const page = await listMembers(repository);

  assert.equal(calls[0].take, 4);
  assert.deepEqual(
    page.members.map((member) => member.id),
    ['member-0', 'member-1', 'member-2'],
  );
  assert.equal(page.nextCursor, 'member-2');
});

test('a last page that is exactly full still reports no cursor', async () => {
  const { repository } = prayerRepository({ total: 3, rows: rowsNamed(3, 'request') });

  const page = await listRequests(repository);

  assert.equal(page.items.length, 3);
  assert.equal(page.nextCursor, null);
});

test('an empty result reports no cursor', async () => {
  const { repository } = membershipsRepository({ total: 0, rows: [] });

  const page = await listMembers(repository);

  assert.deepEqual(page.members, []);
  assert.equal(page.nextCursor, null);
});

test('a cursor seeks past the anchor row instead of counting an offset', async () => {
  const { repository, calls } = prayerRepository({ total: 12, rows: rowsNamed(4, 'request') });

  await listRequests(repository, { cursor: 'request-anchor' });

  assert.deepEqual(calls[0].cursor, { id: 'request-anchor' });
  assert.equal(calls[0].skip, 1);
});

test('paging without a cursor still skips by offset', async () => {
  const { repository, calls } = membershipsRepository({ total: 12, rows: rowsNamed(4, 'member') });

  await listMembers(repository, { page: 3 });

  assert.equal(calls[0].skip, 6);
  assert.equal(calls[0].cursor, undefined);
});

test('both lists break createdAt ties on id so a cursor can never sit between equal rows', async () => {
  const { repository: requests, calls: requestCalls } = prayerRepository({
    total: 12,
    rows: rowsNamed(4, 'request'),
  });
  const { repository: members, calls: memberCalls } = membershipsRepository({
    total: 12,
    rows: rowsNamed(4, 'member'),
  });

  await listRequests(requests);
  await listMembers(members);

  for (const orderBy of [requestCalls[0].orderBy, memberCalls[0].orderBy]) {
    assert.deepEqual(orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
  }
});

test('an offset page number is clamped to the last page, a cursor page number is not', async () => {
  const clamped = await listRequests(
    prayerRepository({ total: 6, rows: rowsNamed(2, 'request') }).repository,
    {
      page: 99,
    },
  );

  // Offset paging past the end would return nothing, so it walks back to the last page.
  assert.equal(clamped.page, 2);

  const seeked = await listRequests(
    prayerRepository({ total: 6, rows: rowsNamed(2, 'request') }).repository,
    {
      cursor: 'request-anchor',
      page: 99,
    },
  );

  // A cursor already knows where it is; clamping would rewrite the caller's own bookkeeping.
  assert.equal(seeked.page, 99);
});
