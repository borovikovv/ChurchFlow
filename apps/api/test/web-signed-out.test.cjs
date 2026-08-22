const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '../../..');
const WEB_ORIGIN = 'https://churchflow.test';

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

class FakeCookies {
  constructor() {
    this.operations = [];
  }

  set(name, value, options) {
    this.operations.push({ name, value, options });
  }
}

// NextResponse is both a constructor and a namespace of static helpers; the route uses
// `new NextResponse(...)` for the 403 and `NextResponse.redirect(...)` for the rest.
function FakeNextResponse(body, init) {
  return { kind: 'response', body, status: init?.status, cookies: new FakeCookies() };
}
FakeNextResponse.redirect = (url) => ({
  kind: 'redirect',
  details: { url },
  cookies: new FakeCookies(),
});

const serverEnv = {
  NEXT_PUBLIC_WEB_URL: WEB_ORIGIN,
  NODE_ENV: 'production',
  COOKIE_DOMAIN: undefined,
};
const shared = {
  AUTH_COOKIE_NAMES: {
    session: 'churchflow_session',
    access: 'churchflow_access',
    refresh: 'churchflow_refresh',
  },
};
const authCookies = loadTypeScript('apps/web/src/auth/auth-cookies.ts', {
  '@churchflow/shared': shared,
  '@/env/server': { serverEnv },
});
const routePolicy = loadTypeScript('apps/web/src/auth/route-policy.ts');
const signedOut = loadTypeScript('apps/web/app/(auth)/signed-out/route.ts', {
  'next/server': { NextResponse: FakeNextResponse },
  '@/auth/auth-cookies': authCookies,
  '@/auth/route-policy': routePolicy,
  '@/env/server': { serverEnv },
  '@/routes': { APP_ROUTES: { login: '/login' } },
});

function requestFor(target, headers = {}) {
  const url = new URL(target, WEB_ORIGIN);

  return { url: url.toString(), nextUrl: url, headers: new Headers(headers) };
}

test('signing out clears the session cookie and both legacy cookies', () => {
  const response = signedOut.GET(requestFor('/signed-out'));

  assert.equal(response.kind, 'redirect');
  assert.deepEqual(
    response.cookies.operations.map(({ name }) => name),
    ['churchflow_session', 'churchflow_access', 'churchflow_refresh'],
  );
  for (const { value, options } of response.cookies.operations) {
    assert.equal(value, '');
    assert.equal(options.expires.getTime(), 0);
    assert.equal(options.httpOnly, true);
    assert.equal(options.path, '/');
  }
});

test('the page the visitor was denied survives the trip to login', () => {
  const response = signedOut.GET(requestFor('/signed-out?redirectTo=%2Fdashboard%2Forg%2Fbudget'));

  assert.equal(response.details.url.pathname, '/login');
  assert.equal(response.details.url.searchParams.get('redirectTo'), '/dashboard/org/budget');
});

test('an off-site redirect target cannot be smuggled through', () => {
  const response = signedOut.GET(requestFor('/signed-out?redirectTo=https%3A%2F%2Fevil.example'));

  assert.equal(response.details.url.searchParams.get('redirectTo'), '/');
});

test('a cross-site page cannot force a sign-out', () => {
  const response = signedOut.GET(requestFor('/signed-out', { origin: 'https://evil.example' }));

  assert.equal(response.status, 403);
  assert.deepEqual(response.cookies.operations, []);
});

test('a same-origin request is allowed, with or without an origin header', () => {
  for (const headers of [{}, { origin: WEB_ORIGIN }]) {
    const response = signedOut.GET(requestFor('/signed-out', headers));

    assert.equal(response.kind, 'redirect');
    assert.equal(response.cookies.operations.length, 3);
  }
});
