const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { SessionAuthGuard } = require('../dist/common/guards/session-auth.guard.js');
const {
  RequestContextService,
} = require('../dist/common/context/request-context.service.js');
const {
  SESSION_IDLE_TTL_SECONDS,
  SESSION_TOUCH_INTERVAL_SECONDS,
  sessionIdleExpiresAt,
  shouldTouchSession,
} = require('../dist/common/auth/session-policy.js');
const { AuthRepository } = require('../dist/modules/auth/auth.repository.js');

const SESSION_ID = '3d3205cc-e8f4-4eb5-9b57-fcd1ffed8dd0';
const USER_ID = 'b919dd9a-12d5-4460-b0e2-f22f85ca507b';
const DAY = 24 * 60 * 60 * 1000;

function activeSession(overrides = {}) {
  return {
    id: SESSION_ID,
    userId: USER_ID,
    type: 'user',
    expiresAt: new Date(Date.now() + 30 * DAY),
    absoluteExpiresAt: new Date(Date.now() + 180 * DAY),
    lastUsedAt: new Date(Date.now() - 60_000),
    revokedAt: null,
    user: { deletedAt: null },
    ...overrides,
  };
}

function createGuard(session, calls = {}) {
  calls.findUnique = [];
  calls.update = [];
  const prisma = {
    session: {
      findUnique: async (args) => {
        calls.findUnique.push(args);
        return session;
      },
      update: async (args) => {
        calls.update.push(args);
        return { id: SESSION_ID };
      },
    },
  };
  return new SessionAuthGuard(prisma, new RequestContextService());
}

class FakeResponse {
  constructor() {
    this.cookies = [];
  }

  cookie(name, value, options) {
    this.cookies.push({ name, value, options });
  }
}

function executionContext(request, response = new FakeResponse()) {
  return { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) };
}

function bearerRequest(token) {
  return { headers: { authorization: `Bearer ${token}` } };
}

function cookieRequest(token) {
  return { headers: { cookie: `churchflow_session=${encodeURIComponent(token)}` } };
}

test('a live session authenticates and exposes only the user and session ids', async () => {
  const calls = {};
  const guard = createGuard(activeSession(), calls);
  const request = bearerRequest('opaque-session-token');

  assert.equal(await guard.canActivate(executionContext(request)), true);
  assert.deepEqual(request.auth, { userId: USER_ID, sessionId: SESSION_ID });
  assert.equal(calls.findUnique.length, 1);
});

test('the raw token never reaches the database, only its sha-256 hash', async () => {
  const calls = {};
  const guard = createGuard(activeSession(), calls);
  const token = 'opaque-session-token';

  await guard.canActivate(executionContext(bearerRequest(token)));

  const { tokenHash } = calls.findUnique[0].where;
  assert.equal(tokenHash, createHash('sha256').update(token).digest('hex'));
  assert.notEqual(tokenHash, token);
});

test('the session cookie is accepted when there is no bearer header', async () => {
  const calls = {};
  const guard = createGuard(activeSession(), calls);
  const request = cookieRequest('opaque-session-token');

  assert.equal(await guard.canActivate(executionContext(request)), true);
  assert.equal(
    calls.findUnique[0].where.tokenHash,
    createHash('sha256').update('opaque-session-token').digest('hex'),
  );
});

test('authentication costs exactly one query when the idle window is fresh', async () => {
  const calls = {};
  const guard = createGuard(activeSession(), calls);

  await guard.canActivate(executionContext(bearerRequest('opaque-session-token')));

  assert.equal(calls.findUnique.length, 1);
  assert.equal(calls.update.length, 0);
});

test('a request without any credentials is rejected before touching the database', async () => {
  const calls = {};
  const guard = createGuard(activeSession(), calls);

  await assert.rejects(
    guard.canActivate(executionContext({ headers: {} })),
    /Missing session token/,
  );
  assert.equal(calls.findUnique.length, 0);
});

for (const [name, session] of [
  ['unknown', null],
  ['revoked', activeSession({ revokedAt: new Date() })],
  ['idle-expired', activeSession({ expiresAt: new Date(Date.now() - 1) })],
  ['past its absolute ceiling', activeSession({ absoluteExpiresAt: new Date(Date.now() - 1) })],
  ['owned by a deleted user', activeSession({ user: { deletedAt: new Date() } })],
  ['a service session, not a user session', activeSession({ type: 'service' })],
]) {
  test(`a session that is ${name} is rejected`, async () => {
    const guard = createGuard(session);
    const request = bearerRequest('opaque-session-token');

    await assert.rejects(
      guard.canActivate(executionContext(request)),
      /Session is no longer active/,
    );
    assert.equal(request.auth, undefined);
  });
}

test('the idle window is pushed forward once the touch interval has passed', async () => {
  const calls = {};
  const session = activeSession({
    lastUsedAt: new Date(Date.now() - (SESSION_TOUCH_INTERVAL_SECONDS * 1000 + 1000)),
  });
  const guard = createGuard(session, calls);

  const before = Date.now();
  await guard.canActivate(executionContext(bearerRequest('opaque-session-token')));

  assert.equal(calls.update.length, 1);
  const { where, data } = calls.update[0];
  assert.deepEqual(where, { id: SESSION_ID });
  assert.ok(data.expiresAt.getTime() >= before + SESSION_IDLE_TTL_SECONDS * 1000 - 1000);
  assert.ok(data.lastUsedAt.getTime() >= before);
});

test('a session used for the first time is touched immediately', async () => {
  const calls = {};
  const guard = createGuard(activeSession({ lastUsedAt: null }), calls);

  await guard.canActivate(executionContext(bearerRequest('opaque-session-token')));

  assert.equal(calls.update.length, 1);
});

// The API's Set-Cookie cannot reach the browser: pages call the API from the Next server,
// which drops it. Rolling the cookie is the web middleware's job, so the guard must not
// pretend to do it here.
test('the guard never writes cookies, only session rows', async () => {
  const calls = {};
  const guard = createGuard(activeSession({ lastUsedAt: null }), calls);
  const response = new FakeResponse();

  await guard.canActivate(executionContext(cookieRequest('opaque-session-token'), response));

  assert.equal(calls.update.length, 1);
  assert.deepEqual(response.cookies, []);
});

test('sliding never pushes the idle window past the absolute ceiling', () => {
  const now = new Date();
  const ceiling = new Date(now.getTime() + DAY);

  assert.equal(sessionIdleExpiresAt(now, ceiling).getTime(), ceiling.getTime());
  assert.equal(
    sessionIdleExpiresAt(now, new Date(now.getTime() + 180 * DAY)).getTime(),
    now.getTime() + SESSION_IDLE_TTL_SECONDS * 1000,
  );
});

test('shouldTouchSession throttles writes to one per interval', () => {
  const now = new Date();

  assert.equal(shouldTouchSession(null, now), true);
  assert.equal(shouldTouchSession(new Date(now.getTime() - 60_000), now), false);
  assert.equal(
    shouldTouchSession(new Date(now.getTime() - SESSION_TOUCH_INTERVAL_SECONDS * 1000), now),
    true,
  );
});

test('revoking by token hash records the reason and skips already closed sessions', async () => {
  let args;
  const prisma = {
    session: {
      updateMany: async (received) => {
        args = received;
        return { count: 1 };
      },
    },
  };
  const repository = new AuthRepository(prisma);

  const count = await repository.revokeSessionByTokenHash('token-hash', 'logout');

  assert.deepEqual(args.where, { tokenHash: 'token-hash', revokedAt: null });
  assert.equal(args.data.revokedReason, 'logout');
  assert.ok(args.data.revokedAt instanceof Date);
  assert.equal(count, 1);
});

test('revoking an unknown token is a no-op rather than an error', async () => {
  const prisma = { session: { updateMany: async () => ({ count: 0 }) } };
  const repository = new AuthRepository(prisma);

  assert.equal(await repository.revokeSessionByTokenHash('never-issued', 'logout'), 0);
});
