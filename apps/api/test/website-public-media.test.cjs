require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  PUBLIC_WEBSITE_MEDIA_HEADERS,
  PUBLIC_WEBSITE_MEDIA_PATH,
  publicWebsiteMediaUrl,
} = require('../dist/modules/media/public-media-url.js');
const { WebsitesController } = require('../dist/modules/websites/websites.controller.js');
const { WebsitesService } = require('../dist/modules/websites/websites.service.js');
const {
  WebsitesRepository,
} = require('../dist/modules/websites/repositories/websites.repository.js');

const ORG = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG = '00000000-0000-4000-8000-000000000002';
const LOGO = '11111111-1111-4111-8111-000000000001';
const WEBSITE_OG = '11111111-1111-4111-8111-000000000002';
const PAGE_OG = '11111111-1111-4111-8111-000000000003';
const DRAFT_PAGE_OG = '11111111-1111-4111-8111-000000000004';
const VISIBLE_BACKGROUND = '11111111-1111-4111-8111-000000000005';
const HIDDEN_BACKGROUND = '11111111-1111-4111-8111-000000000006';
const UNPUBLISHED_LOGO = '11111111-1111-4111-8111-000000000007';
const DELETED = '11111111-1111-4111-8111-000000000008';
const UNREFERENCED = '11111111-1111-4111-8111-000000000009';
const FOREIGN = '11111111-1111-4111-8111-00000000000a';
const UNKNOWN = '11111111-1111-4111-8111-0000000000ff';

const NOT_FOUND = /Media asset was not found/u;

/**
 * Enough of Prisma's where language to answer the reachability query against fixture rows: scalar
 * equality, `{ not: null }`, `OR`, a to-one relation, `some` on a to-many, and the `path`/`equals`
 * JSON filter. It implements the operators this repository uses and nothing more, so it pins what
 * the query asks for; only a real Postgres can prove the query itself is valid.
 */
function matchesValue(value, condition) {
  if (condition === null || typeof condition !== 'object') return value === condition;
  if ('not' in condition) return !matchesValue(value, condition.not);
  if ('path' in condition) {
    const found = condition.path.reduce(
      (current, key) =>
        current === null || typeof current !== 'object' ? undefined : current[key],
      value,
    );

    return found === condition.equals;
  }
  if ('equals' in condition) return value === condition.equals;

  throw new Error(`the fake prisma does not implement ${JSON.stringify(condition)}`);
}

function matches(row, where, relation) {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') return condition.some((branch) => matches(row, branch, relation));

    const related = relation(row, key);
    if (related === undefined) return matchesValue(row[key], condition);
    if (Array.isArray(related)) {
      return related.some((child) => matches(child, condition.some, relation));
    }

    return related !== null && matches(related, condition, relation);
  });
}

function createPrisma(data) {
  const relations = {
    organization: (row) => data.organizations.find((org) => org.id === row.organizationId) ?? null,
    pages: (row) => data.pages.filter((page) => page.websiteId === row.id),
    sections: (row) => data.sections.filter((section) => section.pageId === row.id),
  };
  const relation = (row, key) => (key in relations ? relations[key](row) : undefined);
  const queries = [];
  const findFirst = (rows) => async (args) => {
    queries.push(args);

    return rows.find((row) => matches(row, args.where, relation)) ?? null;
  };

  return {
    queries,
    prisma: {
      mediaAsset: { findFirst: findFirst(data.assets) },
      organizationWebsite: { findFirst: findFirst(data.websites) },
    },
  };
}

function asset(id, overrides = {}) {
  return {
    id,
    organizationId: ORG,
    bucket: 'bucket',
    objectKey: `organizations/${ORG}/website-sections/${id}.jpg`,
    deletedAt: null,
    ...overrides,
  };
}

function fixtures() {
  return {
    organizations: [
      { id: ORG, status: 'ACTIVE', deletedAt: null },
      { id: OTHER_ORG, status: 'ACTIVE', deletedAt: null },
    ],
    assets: [
      asset(LOGO),
      asset(WEBSITE_OG),
      asset(PAGE_OG),
      asset(DRAFT_PAGE_OG),
      asset(VISIBLE_BACKGROUND),
      asset(HIDDEN_BACKGROUND),
      asset(UNPUBLISHED_LOGO, { organizationId: OTHER_ORG }),
      asset(DELETED, { deletedAt: new Date('2026-09-01T00:00:00Z') }),
      asset(UNREFERENCED),
      asset(FOREIGN),
    ],
    websites: [
      {
        id: 'website-1',
        organizationId: ORG,
        logoAssetId: LOGO,
        settings: { seo: { ogImageAssetId: WEBSITE_OG } },
        publishedAt: new Date('2026-09-01T00:00:00Z'),
        deletedAt: null,
      },
      {
        id: 'website-2',
        organizationId: OTHER_ORG,
        logoAssetId: UNPUBLISHED_LOGO,
        settings: { seo: { ogImageAssetId: null } },
        publishedAt: null,
        deletedAt: null,
      },
      {
        // Published, and pointing at an asset of the first organization. Asset ids in website JSON
        // are not checked against the organization when they are saved, so this is the case the
        // route has to refuse rather than the one it has to honour.
        id: 'website-3',
        organizationId: OTHER_ORG,
        logoAssetId: null,
        settings: { seo: { ogImageAssetId: FOREIGN } },
        publishedAt: new Date('2026-09-01T00:00:00Z'),
        deletedAt: null,
      },
    ],
    pages: [
      {
        id: 'page-1',
        websiteId: 'website-1',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-09-02T00:00:00Z'),
        deletedAt: null,
        seo: { ogImageAssetId: PAGE_OG },
      },
      {
        id: 'page-2',
        websiteId: 'website-1',
        status: 'DRAFT',
        publishedAt: null,
        deletedAt: null,
        seo: { ogImageAssetId: DRAFT_PAGE_OG },
      },
    ],
    sections: [
      {
        id: 'section-1',
        pageId: 'page-1',
        hidden: false,
        deletedAt: null,
        content: { backgroundImageAssetId: VISIBLE_BACKGROUND },
      },
      {
        id: 'section-2',
        pageId: 'page-1',
        hidden: true,
        deletedAt: null,
        content: { backgroundImageAssetId: HIDDEN_BACKGROUND },
      },
      {
        id: 'section-3',
        pageId: 'page-2',
        hidden: false,
        deletedAt: null,
        content: { backgroundImageAssetId: DRAFT_PAGE_OG },
      },
    ],
  };
}

function buildService(data = fixtures()) {
  const { prisma, queries } = createPrisma(data);
  const signed = [];
  const mediaService = {
    signReadUrl: async (object) => {
      signed.push(object);

      return `https://storage.test/${object.bucket}/${object.objectKey}?X-Amz-Signature=abc`;
    },
  };
  const service = new WebsitesService(new WebsitesRepository(prisma), mediaService);

  return { service, signed, queries };
}

test('media a published website references is served as a signed read of that object', async () => {
  const reachable = [
    ['the website logo', LOGO],
    ['the website og image', WEBSITE_OG],
    ['a published page og image', PAGE_OG],
    ['a visible section background', VISIBLE_BACKGROUND],
  ];

  for (const [label, assetId] of reachable) {
    const { service, signed } = buildService();
    const objectKey = `organizations/${ORG}/website-sections/${assetId}.jpg`;

    assert.equal(
      await service.findPublicWebsiteMediaUrl(assetId),
      `https://storage.test/bucket/${objectKey}?X-Amz-Signature=abc`,
      label,
    );
    assert.deepEqual(signed, [{ bucket: 'bucket', objectKey }], label);
  }
});

test('an id a client upper-cased still resolves against the stored lowercase references', async () => {
  const { service } = buildService();

  assert.match(await service.findPublicWebsiteMediaUrl(LOGO.toUpperCase()), /X-Amz-Signature/u);
});

test('media only an unpublished surface references is not public', async () => {
  const unreachable = [
    ['a draft page og image', DRAFT_PAGE_OG],
    ['a hidden section background', HIDDEN_BACKGROUND],
    ['the logo of an unpublished website', UNPUBLISHED_LOGO],
    ['a soft-deleted asset', DELETED],
    ['an asset no website references', UNREFERENCED],
    ["an asset only another organization's website references", FOREIGN],
    ['an id that names nothing', UNKNOWN],
  ];

  for (const [label, assetId] of unreachable) {
    const { service, signed } = buildService();

    await assert.rejects(() => service.findPublicWebsiteMediaUrl(assetId), NOT_FOUND, label);
    assert.deepEqual(signed, [], label);
  }
});

test('a website whose organization is no longer active stops serving its media', async () => {
  const organizations = [
    { id: ORG, status: 'SUSPENDED', deletedAt: null },
    { id: ORG, status: 'ACTIVE', deletedAt: new Date('2026-09-10T00:00:00Z') },
  ];

  for (const organization of organizations) {
    const data = fixtures();
    data.organizations[0] = organization;
    const { service } = buildService(data);

    await assert.rejects(() => service.findPublicWebsiteMediaUrl(LOGO), NOT_FOUND);
  }
});

test('a soft-deleted website stops serving its media', async () => {
  const data = fixtures();
  data.websites[0].deletedAt = new Date('2026-09-10T00:00:00Z');
  const { service } = buildService(data);

  await assert.rejects(() => service.findPublicWebsiteMediaUrl(LOGO), NOT_FOUND);
});

test('a soft-deleted section stops serving its background', async () => {
  const data = fixtures();
  data.sections[0].deletedAt = new Date('2026-09-10T00:00:00Z');
  const { service } = buildService(data);

  await assert.rejects(() => service.findPublicWebsiteMediaUrl(VISIBLE_BACKGROUND), NOT_FOUND);
});

test('an id that is not a uuid is refused before anything is queried', async () => {
  const malformed = ['not-a-uuid', '../../etc/passwd', `${LOGO}/../${FOREIGN}`, '', '%2e%2e'];

  for (const assetId of malformed) {
    const { service, queries } = buildService();

    await assert.rejects(() => service.findPublicWebsiteMediaUrl(assetId), NOT_FOUND, assetId);
    assert.deepEqual(queries, [], assetId);
  }
});

test('an unreachable asset, an unknown id and a malformed one are refused identically', async () => {
  const { service } = buildService();
  const refusals = [];

  for (const assetId of [UNREFERENCED, UNKNOWN, DELETED, 'not-a-uuid']) {
    await service.findPublicWebsiteMediaUrl(assetId).catch((error) => {
      refusals.push(`${error.getStatus()} ${error.message}`);
    });
  }

  assert.equal(refusals.length, 4);
  assert.deepEqual([...new Set(refusals)], ['404 Media asset was not found']);
});

test('the route answers with a cacheable temporary redirect and no body', async () => {
  const signedUrl = 'https://storage.test/bucket/logo.png?X-Amz-Signature=abc';
  const controller = new WebsitesController({
    findPublicWebsiteMediaUrl: async (assetId) => {
      assert.equal(assetId, LOGO);

      return signedUrl;
    },
  });
  const headers = {};
  const redirects = [];
  const response = {
    setHeader: (name, value) => {
      headers[name] = value;
    },
    redirect: (status, url) => {
      redirects.push({ status, url });
    },
    json: () => assert.fail('the redirect must not carry a body'),
    send: () => assert.fail('the redirect must not carry a body'),
  };

  assert.equal(await controller.publicWebsiteMedia(LOGO, response), undefined);
  assert.deepEqual(redirects, [{ status: 302, url: signedUrl }]);
  assert.deepEqual(headers, { ...PUBLIC_WEBSITE_MEDIA_HEADERS });
});

test('the redirect may not be cached for as long as the signature it points at lasts', () => {
  const cacheControl = PUBLIC_WEBSITE_MEDIA_HEADERS['Cache-Control'];
  const maxAge = Number(/max-age=(\d+)/u.exec(cacheControl)[1]);

  assert.match(cacheControl, /public/u);
  assert.ok(maxAge > 0);
  // The reads MediaService signs last 300 seconds, and a cached redirect has to leave the fetch
  // that follows it most of that.
  assert.ok(maxAge <= 120, 'a cached redirect must not outlive the url it points at');
});

test('the redirect may be embedded by the website it belongs to, on another origin', () => {
  assert.equal(PUBLIC_WEBSITE_MEDIA_HEADERS['Cross-Origin-Resource-Policy'], 'cross-origin');
});

test('the route the api serves is the route the published links point at', () => {
  const routePath = Reflect.getMetadata('path', WebsitesController.prototype.publicWebsiteMedia);
  const url = publicWebsiteMediaUrl('https://api.example.test/v1', LOGO);

  assert.equal(routePath, `${PUBLIC_WEBSITE_MEDIA_PATH}/:assetId`);
  assert.equal(url, `https://api.example.test/v1/${routePath.replace(':assetId', LOGO)}`);
  assert.equal(
    publicWebsiteMediaUrl('https://api.example.test/v1/', LOGO),
    url,
    'a configured base url with a trailing slash builds the same link',
  );
});

test('the public media route carries no guard, so no session can change its answer', () => {
  assert.equal(
    Reflect.getMetadata('__guards__', WebsitesController.prototype.publicWebsiteMedia),
    undefined,
  );
});
