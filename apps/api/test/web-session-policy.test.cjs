const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
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
const sessionHelpers = loadTypeScript('apps/web/src/auth/middleware-session.ts');
const webJwtKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const webPublicKeyPem = webJwtKeys.publicKey.export({ type: 'spki', format: 'pem' });

function signedAccessToken(exp) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), webJwtKeys.privateKey);
  return `${header}.${payload}.${signature.toString('base64url')}`;
}

test('route policy explicitly allows public pages and defaults new pages to protected', () => {
  for (const pathname of [
    '/',
    '/login',
    '/o/church',
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

test('session helpers verify signature and safely replace the current request cookie', async () => {
  const validToken = signedAccessToken(1_100);
  const modifiedToken = `${validToken.slice(0, -1)}${validToken.endsWith('a') ? 'b' : 'a'}`;

  assert.equal(await sessionHelpers.isAccessTokenFresh(validToken, webPublicKeyPem, 1_000), true);
  assert.equal(
    await sessionHelpers.isAccessTokenFresh(signedAccessToken(1_004), webPublicKeyPem, 1_000),
    false,
  );
  assert.equal(
    await sessionHelpers.isAccessTokenFresh(modifiedToken, webPublicKeyPem, 1_000),
    false,
  );
  assert.equal(await sessionHelpers.isAccessTokenFresh('invalid', webPublicKeyPem, 1_000), false);
  assert.equal(
    sessionHelpers.setCookieHeader(
      'other=value; churchflow_access=old',
      'churchflow_access',
      'new',
    ),
    'other=value; churchflow_access=new',
  );
  assert.equal(
    sessionHelpers.internalRedirectTarget('/dashboard/org', '?tab=members'),
    '/dashboard/org?tab=members',
  );
  assert.equal(sessionHelpers.internalRedirectTarget('//evil.example', '?x=1'), '/?x=1');
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
  '@churchflow/shared': {
    AUTH_COOKIE_NAMES: { access: 'churchflow_access', refresh: 'churchflow_refresh' },
  },
  './src/auth/route-policy': routePolicy,
  './src/auth/middleware-session': sessionHelpers,
});

function requestFor(url, cookies = {}) {
  const parsed = new URL(url);
  const cookieHeader = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

  return {
    url,
    nextUrl: parsed,
    headers: new Headers(cookieHeader ? { cookie: cookieHeader } : {}),
    cookies: { get: (name) => (cookies[name] ? { value: cookies[name] } : undefined) },
  };
}

test('middleware injects refreshed access into current request and response cookie', async () => {
  const originalFetch = global.fetch;
  const originalPublicKey = process.env.JWT_ACCESS_PUBLIC_KEY;
  process.env.JWT_ACCESS_PUBLIC_KEY = webPublicKeyPem;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      accessToken: 'new-access-token',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    }),
  });

  try {
    const validToken = signedAccessToken(Math.floor(Date.now() / 1000) + 900);
    const modifiedToken = `${validToken.slice(0, -1)}${validToken.endsWith('a') ? 'b' : 'a'}`;
    const response = await middlewareModule.middleware(
      requestFor('https://churchflow.test/dashboard/org', {
        churchflow_access: modifiedToken,
        churchflow_refresh: 'valid-refresh-token',
      }),
    );

    assert.equal(response.kind, 'next');
    assert.match(
      response.details.request.headers.get('cookie'),
      /churchflow_access=new-access-token/,
    );
    assert.equal(response.cookies.operations[0].name, 'churchflow_access');
    assert.equal(response.cookies.operations[0].value, 'new-access-token');
  } finally {
    global.fetch = originalFetch;
    if (originalPublicKey === undefined) delete process.env.JWT_ACCESS_PUBLIC_KEY;
    else process.env.JWT_ACCESS_PUBLIC_KEY = originalPublicKey;
  }
});

test('middleware handles anonymous public routes and protects unknown routes without loops', async () => {
  const publicResponse = await middlewareModule.middleware(
    requestFor('https://churchflow.test/login'),
  );
  assert.equal(publicResponse.kind, 'next');

  const protectedResponse = await middlewareModule.middleware(
    requestFor('https://churchflow.test/future-page?tab=one'),
  );
  assert.equal(protectedResponse.kind, 'redirect');
  assert.equal(
    protectedResponse.details.url.searchParams.get('redirectTo'),
    '/future-page?tab=one',
  );
});

test('failed refresh continues public route anonymously but redirects protected route', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false });

  try {
    const publicResponse = await middlewareModule.middleware(
      requestFor('https://churchflow.test/member-claims/accept?token=claim', {
        churchflow_refresh: 'invalid-refresh',
      }),
    );
    assert.equal(publicResponse.kind, 'next');
    assert.deepEqual(
      publicResponse.cookies.operations.map(({ name }) => name),
      ['churchflow_access', 'churchflow_refresh'],
    );

    const protectedResponse = await middlewareModule.middleware(
      requestFor('https://churchflow.test/organization-request/status', {
        churchflow_refresh: 'invalid-refresh',
      }),
    );
    assert.equal(protectedResponse.kind, 'redirect');
    assert.equal(
      protectedResponse.details.url.searchParams.get('redirectTo'),
      '/organization-request/status',
    );
  } finally {
    global.fetch = originalFetch;
  }
});
