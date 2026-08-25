const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '../../..');

function loadTypeScript(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: relativePath,
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = (specifier) =>
    Object.hasOwn(dependencies, specifier) ? dependencies[specifier] : require(specifier);
  new Function('require', 'module', 'exports', output)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

const routePolicy = loadTypeScript('apps/web/src/auth/route-policy.ts');
const SESSION_IDLE_TTL_SECONDS = 30 * 24 * 60 * 60;
const sharedEdge = {
  AUTH_COOKIE_NAMES: {
    session: 'churchflow_session',
    access: 'churchflow_access',
    refresh: 'churchflow_refresh',
  },
  SESSION_IDLE_TTL_SECONDS,
};

test('route policy explicitly allows public pages and defaults new pages to protected', () => {
  for (const pathname of [
    '/',
    '/login',
    '/o/church',
    '/signed-out',
    '/invitations/accept?token=value',
    '/member-claims/accept?token=value',
    '/platform-admin/bootstrap?token=value',
  ]) {
    assert.equal(routePolicy.isPublicRoute(pathname), true, pathname);
    assert.equal(routePolicy.isProtectedRoute(pathname), false, pathname);
  }

  for (const pathname of [
    '/dashboard/organization',
    '/admin/organizations',
    '/organization-request',
    '/organization-request/status',
    '/member-claims/status',
    '/profile',
    '/login-evil',
    '//login',
    '/organization-request-evil',
    '/future-application-page',
  ]) {
    assert.equal(routePolicy.isProtectedRoute(pathname), true, pathname);
  }
});

test('route policy excludes Next internals, API paths and static assets', () => {
  for (const pathname of [
    '/_next/static/chunk.js',
    '/_next/image',
    '/api/health',
    '/v1/auth/telegram/start',
    '/favicon.ico',
    '/robots.txt',
    '/images/logo.svg',
    '/fonts/app.woff2',
  ]) {
    assert.equal(routePolicy.isStaticOrInternalPath(pathname), true, pathname);
    assert.equal(routePolicy.isProtectedRoute(pathname), false, pathname);
  }
});

test('a redirect target cannot be pointed outside this application', () => {
  assert.equal(
    routePolicy.internalRedirectTarget('/dashboard/org', '?tab=members'),
    '/dashboard/org?tab=members',
  );
  assert.equal(routePolicy.internalRedirectTarget('//evil.example', '?x=1'), '/?x=1');
  assert.equal(routePolicy.internalRedirectTarget('https://evil.example', ''), '/');
  assert.equal(routePolicy.internalRedirectTarget('/dashboard', 'tab=members'), '/dashboard');
});

class FakeCookies {
  constructor() {
    this.operations = [];
  }

  set(name, value, options) {
    this.operations.push({ name, value, options });
  }
}

class FakeNextResponse {
  constructor(kind, details) {
    this.kind = kind;
    this.details = details;
    this.cookies = new FakeCookies();
  }

  static next(details) {
    return new FakeNextResponse('next', details);
  }

  static redirect(url) {
    return new FakeNextResponse('redirect', { url });
  }
}

const middlewareModule = loadTypeScript('apps/web/middleware.ts', {
  'next/server': { NextResponse: FakeNextResponse },
  './src/shared/edge': sharedEdge,
  './src/auth/route-policy': routePolicy,
});

function requestFor(url, cookies = {}) {
  return {
    url,
    nextUrl: new URL(url),
    headers: new Headers(),
    cookies: {
      has: (name) => Object.hasOwn(cookies, name),
      get: (name) => (Object.hasOwn(cookies, name) ? { value: cookies[name] } : undefined),
    },
  };
}

test('a request carrying a session cookie is passed through', () => {
  for (const url of [
    'https://churchflow.test/dashboard/org',
    'https://churchflow.test/login',
    'https://churchflow.test/future-page',
  ]) {
    const response = middlewareModule.middleware(
      requestFor(url, { churchflow_session: 'opaque-session-token' }),
    );

    assert.equal(response.kind, 'next', url);
  }
});

test('an anonymous visitor reaches public routes and is sent to login from protected ones', () => {
  const publicResponse = middlewareModule.middleware(requestFor('https://churchflow.test/login'));
  assert.equal(publicResponse.kind, 'next');

  const protectedResponse = middlewareModule.middleware(
    requestFor('https://churchflow.test/future-page?tab=one'),
  );
  assert.equal(protectedResponse.kind, 'redirect');
  assert.equal(
    protectedResponse.details.url.searchParams.get('redirectTo'),
    '/future-page?tab=one',
  );
});

test('cookies from the previous access/refresh scheme do not count as a session', () => {
  const response = middlewareModule.middleware(
    requestFor('https://churchflow.test/dashboard/org', {
      churchflow_access: 'stale-access-token',
      churchflow_refresh: 'stale-refresh-token',
    }),
  );

  assert.equal(response.kind, 'redirect');
  assert.equal(response.details.url.searchParams.get('redirectTo'), '/dashboard/org');
});

test('middleware never calls the API', () => {
  const originalFetch = global.fetch;
  global.fetch = () => {
    throw new Error('middleware must not reach the API');
  };

  try {
    middlewareModule.middleware(
      requestFor('https://churchflow.test/dashboard/org', { churchflow_session: 'token' }),
    );
    middlewareModule.middleware(requestFor('https://churchflow.test/dashboard/org'));
    middlewareModule.middleware(requestFor('https://churchflow.test/login'));
  } finally {
    global.fetch = originalFetch;
  }
});

// The API cannot roll the cookie: pages reach it from the Next server, which drops its
// Set-Cookie. If middleware stopped doing this the cookie would keep its sign-in expiry
// and an active visitor would be signed out on the idle window's original deadline.
test('a session cookie is rolled forward on every page view', (t) => {
  const originalWebUrl = process.env.NEXT_PUBLIC_WEB_URL;
  process.env.NEXT_PUBLIC_WEB_URL = 'https://churchflow.test';
  t.after(() => {
    if (originalWebUrl === undefined) {
      delete process.env.NEXT_PUBLIC_WEB_URL;
    } else {
      process.env.NEXT_PUBLIC_WEB_URL = originalWebUrl;
    }
  });
  const before = Date.now();
  const response = middlewareModule.middleware(
    requestFor('https://churchflow.test/dashboard/org', {
      churchflow_session: 'opaque-session-token',
    }),
  );

  assert.equal(response.kind, 'next');
  assert.equal(response.cookies.operations.length, 1);
  const [operation] = response.cookies.operations;
  assert.equal(operation.name, 'churchflow_session');
  assert.equal(operation.value, 'opaque-session-token');
  assert.equal(operation.options.httpOnly, true);
  assert.equal(operation.options.sameSite, 'lax');
  assert.equal(operation.options.secure, true);
  assert.equal(operation.options.path, '/');
  assert.equal(Object.hasOwn(operation.options, 'domain'), false);
  assert.ok(operation.options.expires.getTime() >= before + SESSION_IDLE_TTL_SECONDS * 1000 - 1000);
});

test('a visitor without a session cookie is never handed one', () => {
  for (const url of ['https://churchflow.test/login', 'https://churchflow.test/dashboard/org']) {
    const response = middlewareModule.middleware(requestFor(url));

    assert.deepEqual(response.cookies.operations, [], url);
  }
});
