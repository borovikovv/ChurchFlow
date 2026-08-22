const assert = require('node:assert/strict');
const test = require('node:test');
const { AuthService } = require('../dist/modules/auth/auth.service.js');
const { AuthRepository } = require('../dist/modules/auth/auth.repository.js');
const { deviceLabelFromUserAgent } = require('../dist/common/auth/device-label.js');
const { resolveSessionRetentionCutoff } = require('../dist/modules/auth/session-retention.js');

const USER_ID = 'b919dd9a-12d5-4460-b0e2-f22f85ca507b';
const CURRENT_SESSION_ID = '3d3205cc-e8f4-4eb5-9b57-fcd1ffed8dd0';
const OTHER_SESSION_ID = '9f1f6f0e-6f2f-4a4f-9d0f-2f9f0f6f1f6f';
const DAY = 24 * 60 * 60 * 1000;

function createService(repository) {
  return new AuthService(
    {
      getOrThrow(key) {
        throw new Error(`Unexpected config key: ${key}`);
      },
    },
    repository,
  );
}

test('a device label is built from what the user agent actually claims', () => {
  const cases = [
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Chrome on macOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      'Safari on iPhone',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      'Edge on Windows',
    ],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0', 'Firefox on Linux'],
    ['ChurchFlow-Mobile/1.0', undefined],
    [undefined, undefined],
  ];

  for (const [userAgent, expected] of cases) {
    assert.equal(deviceLabelFromUserAgent(userAgent), expected, String(userAgent));
  }
});

test('Chrome is not mistaken for Safari and Edge is not mistaken for Chrome', () => {
  const chrome =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';
  const edge = `${chrome} Edg/131.0.0.0`;

  assert.equal(deviceLabelFromUserAgent(chrome), 'Chrome on macOS');
  assert.equal(deviceLabelFromUserAgent(edge), 'Edge on macOS');
});

test('the session list marks the caller own session and exposes no token material', async () => {
  const service = createService({
    listUserSessions: async (userId) => {
      assert.equal(userId, USER_ID);
      return [
        {
          id: CURRENT_SESSION_ID,
          deviceName: 'Chrome on macOS',
          ipAddress: '203.0.113.7',
          lastUsedAt: new Date('2026-08-22T10:00:00.000Z'),
          createdAt: new Date('2026-08-01T10:00:00.000Z'),
          expiresAt: new Date('2026-09-21T10:00:00.000Z'),
        },
        {
          id: OTHER_SESSION_ID,
          deviceName: null,
          ipAddress: null,
          lastUsedAt: null,
          createdAt: new Date('2026-08-02T10:00:00.000Z'),
          expiresAt: new Date('2026-09-22T10:00:00.000Z'),
        },
      ];
    },
  });

  const sessions = await service.listSessions(USER_ID, CURRENT_SESSION_ID);

  assert.deepEqual(
    sessions.map(({ id, current }) => ({ id, current })),
    [
      { id: CURRENT_SESSION_ID, current: true },
      { id: OTHER_SESSION_ID, current: false },
    ],
  );
  assert.equal(sessions[0].lastUsedAt, '2026-08-22T10:00:00.000Z');
  assert.equal(sessions[1].lastUsedAt, null);
  for (const session of sessions) {
    assert.equal(Object.hasOwn(session, 'tokenHash'), false);
  }
});

test('revoking a session is scoped to the owner and records why', async () => {
  let received;
  const service = createService({
    revokeUserSession: async (sessionId, userId, reason) => {
      received = { sessionId, userId, reason };
      return 1;
    },
  });

  assert.deepEqual(await service.revokeSession(USER_ID, OTHER_SESSION_ID), { ok: true });
  assert.deepEqual(received, {
    sessionId: OTHER_SESSION_ID,
    userId: USER_ID,
    reason: 'user_revoked',
  });
});

test('revoking a session that is not yours reads as not found, not forbidden', async () => {
  const service = createService({ revokeUserSession: async () => 0 });

  await assert.rejects(service.revokeSession(USER_ID, OTHER_SESSION_ID), /Session was not found/);
});

test('signing out other devices keeps the caller signed in', async () => {
  let received;
  const service = createService({
    revokeOtherUserSessions: async (userId, keptSessionId, reason) => {
      received = { userId, keptSessionId, reason };
      return 3;
    },
  });

  assert.deepEqual(await service.revokeOtherSessions(USER_ID, CURRENT_SESSION_ID), {
    revokedCount: 3,
  });
  assert.equal(received.keptSessionId, CURRENT_SESSION_ID);
  assert.equal(received.reason, 'user_revoked');
});

test('the retention cutoff is the retention window before now', () => {
  const now = new Date('2026-08-22T12:00:00.000Z');

  assert.equal(
    resolveSessionRetentionCutoff(now, 30).toISOString(),
    new Date(now.getTime() - 30 * DAY).toISOString(),
  );
});

test('a retention dry run counts without deleting', async () => {
  let purgeCalls = 0;
  const service = createService({
    countPurgeableSessions: async () => 12,
    purgeSessions: async () => {
      purgeCalls += 1;
      return { deletedCount: 12, batches: 1, exhausted: false };
    },
  });

  const result = await service.purgeExpiredSessions({ cutoff: new Date(), dryRun: true });

  assert.deepEqual(result, { deletedCount: 12 });
  assert.equal(purgeCalls, 0);
});

test('retention deletes in batches and reports how many rows went', async () => {
  let received;
  const service = createService({
    purgeSessions: async (input) => {
      received = input;
      return { deletedCount: 7, batches: 1, exhausted: false };
    },
  });
  const cutoff = new Date('2026-07-23T12:00:00.000Z');

  const result = await service.purgeExpiredSessions({ cutoff, dryRun: false });

  assert.deepEqual(result, { deletedCount: 7 });
  assert.equal(received.cutoff, cutoff);
  assert.ok(received.batchSize > 0);
  assert.ok(received.maxBatches > 0);
});

test('the session list query hides revoked and expired rows', async () => {
  let args;
  const prisma = {
    session: {
      findMany: async (received) => {
        args = received;
        return [];
      },
    },
  };
  const repository = new AuthRepository(prisma);

  await repository.listUserSessions(USER_ID);

  assert.equal(args.where.userId, USER_ID);
  assert.equal(args.where.type, 'user');
  assert.equal(args.where.revokedAt, null);
  assert.ok(args.where.expiresAt.gt instanceof Date);
});

test('revoking another account session changes nothing', async () => {
  let args;
  const prisma = {
    session: {
      updateMany: async (received) => {
        args = received;
        return { count: 0 };
      },
    },
  };
  const repository = new AuthRepository(prisma);

  const count = await repository.revokeUserSession(OTHER_SESSION_ID, USER_ID, 'user_revoked');

  assert.equal(count, 0);
  assert.deepEqual(args.where, { id: OTHER_SESSION_ID, userId: USER_ID, revokedAt: null });
});

test('signing out other devices excludes the current session', async () => {
  let args;
  const prisma = {
    session: {
      updateMany: async (received) => {
        args = received;
        return { count: 2 };
      },
    },
  };
  const repository = new AuthRepository(prisma);

  await repository.revokeOtherUserSessions(USER_ID, CURRENT_SESSION_ID, 'user_revoked');

  assert.deepEqual(args.where, {
    userId: USER_ID,
    revokedAt: null,
    id: { not: CURRENT_SESSION_ID },
  });
});
