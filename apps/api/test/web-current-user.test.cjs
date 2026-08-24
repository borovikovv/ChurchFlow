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

const USER = { id: 'user-1', platformRole: 'USER', locale: 'en' };

// The distinction this file guards is the load-bearing decision of the web rewrite: a
// rejected session signs the visitor out, any other failure must not.
function loadSession({ hasCookie = true, result }) {
  let apiCalls = 0;
  const redirects = [];
  const session = loadTypeScript('apps/web/src/auth/session.ts', {
    react: { cache: (fn) => fn },
    'next/headers': { cookies: async () => ({ has: () => hasCookie }) },
    'next/navigation': {
      redirect: (target) => {
        redirects.push(target);
        throw new Error(`NEXT_REDIRECT:${target}`);
      },
    },
    '@churchflow/shared': { AUTH_COOKIE_NAMES: { session: 'churchflow_session' } },
    '@/api/client': {
      UNAUTHENTICATED_ERROR_CODE: 'UNAUTHENTICATED',
      apiFetch: async () => {
        apiCalls += 1;
        return result;
      },
    },
    '@/features/organizations/server/access': {
      getOrganizationAccessState: async () => ({ organizations: [], organizationRequests: [] }),
      isOrganizationAdminRole: () => false,
    },
    '@/features/organizations/routes': {
      organizationHomeRoute: (id) => `/dashboard/${id}`,
      organizationProfileRoute: (id) => `/dashboard/${id}/profile`,
    },
    '@/routes': { APP_ROUTES: { signedOut: '/signed-out', home: '/', login: '/login' } },
  });

  return { session, redirects, apiCalls: () => apiCalls };
}

test('a rejected session reads as signed out', async () => {
  const { session } = loadSession({
    result: {
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'Session is no longer active' },
    },
  });

  assert.equal(await session.getCurrentUser(), null);
});

test('an API outage raises instead of quietly signing the visitor out', async () => {
  const { session } = loadSession({
    result: { ok: false, error: { code: 'API_UNREACHABLE', message: 'connect ECONNREFUSED' } },
  });

  await assert.rejects(session.getCurrentUser(), /Could not load the current user/);
});

test('a server error is an outage too, not a sign-out', async () => {
  const { session } = loadSession({
    result: { ok: false, error: { code: 'HTTP_500', message: 'Request failed' } },
  });

  await assert.rejects(session.getCurrentUser(), /Could not load the current user/);
});

test('an anonymous visitor never costs an API call', async () => {
  const { session, apiCalls } = loadSession({
    hasCookie: false,
    result: { ok: true, data: USER },
  });

  assert.equal(await session.getCurrentUser(), null);
  assert.equal(apiCalls(), 0);
});

test('requireServerSession sends a rejected visitor to be signed out, keeping the page', async () => {
  const { session, redirects } = loadSession({
    result: {
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'Session is no longer active' },
    },
  });

  await assert.rejects(session.requireServerSession('/dashboard/org/budget'), /NEXT_REDIRECT/);
  assert.deepEqual(redirects, ['/signed-out?redirectTo=%2Fdashboard%2Forg%2Fbudget']);
});

test('requireServerSession lets an outage surface rather than redirecting', async () => {
  const { session, redirects } = loadSession({
    result: { ok: false, error: { code: 'HTTP_500', message: 'Request failed' } },
  });

  await assert.rejects(session.requireServerSession('/dashboard/org'), /Could not load/);
  assert.deepEqual(redirects, []);
});
