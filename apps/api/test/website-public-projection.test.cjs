const assert = require('node:assert/strict');
const test = require('node:test');
const { toPublicSection, toPublicWebsite } = require('../dist/modules/websites/public-website.js');
const { MediaService } = require('../dist/modules/media/media.service.js');
const { PagesService } = require('../dist/modules/pages/pages.service.js');
const { WebsitesService } = require('../dist/modules/websites/websites.service.js');

const PUBLIC_API_URL = 'https://api.example.test/v1';
const ORG_ID = '00000000-0000-4000-8000-000000000001';
const LOGO_ASSET = '11111111-1111-4111-8111-000000000001';
const WEBSITE_OG_ASSET = '11111111-1111-4111-8111-000000000002';
const PAGE_OG_ASSET = '11111111-1111-4111-8111-000000000003';
const BACKGROUND_ASSET = '11111111-1111-4111-8111-000000000004';

const config = {
  getOrThrow: (key) =>
    ({
      S3_BUCKET: 'bucket',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'access',
      S3_SECRET_ACCESS_KEY: 'secret',
      PUBLIC_API_URL,
    })[key],
};

// A real MediaService over a fake repository: the point of these tests is which url the projection
// publishes, so the service that builds both kinds of url has to be the real one.
function mediaService(
  knownAssets = [LOGO_ASSET, WEBSITE_OG_ASSET, PAGE_OG_ASSET, BACKGROUND_ASSET],
) {
  const mediaRepository = {
    findAsset: async (assetId, organizationId) =>
      organizationId === ORG_ID && knownAssets.includes(assetId)
        ? { id: assetId, bucket: 'bucket', objectKey: `organizations/${ORG_ID}/${assetId}.jpg` }
        : null,
  };

  return new MediaService(mediaRepository, { has: async () => true }, config);
}

function mediaUrl(assetId) {
  return `${PUBLIC_API_URL}/public/website-media/${assetId}`;
}

function storedWebsite() {
  return {
    id: 'website-1',
    organizationId: ORG_ID,
    title: 'Grace Church',
    description: null,
    theme: {},
    settings: { seo: { ogImageAssetId: WEBSITE_OG_ASSET } },
    publishedAt: new Date('2026-09-01T00:00:00Z'),
    logoAssetId: LOGO_ASSET,
    organization: { name: 'Grace Church', slug: 'grace' },
  };
}

function storedPage() {
  return {
    organizationId: ORG_ID,
    title: 'Home',
    seo: { ogImageAssetId: PAGE_OG_ASSET },
    sections: [
      {
        id: 'section-1',
        type: 'hero',
        order: 0,
        hidden: false,
        content: {
          variant: 'cover',
          headline: 'Welcome',
          backgroundImageAssetId: BACKGROUND_ASSET,
        },
      },
    ],
    website: storedWebsite(),
  };
}

test('a public section only carries keys its type renders, never the asset id', () => {
  const section = toPublicSection({
    id: 'section-1',
    type: 'hero',
    order: 0,
    content: {
      variant: 'cover',
      headline: 'Welcome',
      backgroundImageAssetId: 'asset-1',
      backgroundImageUrl: 'https://cdn.example/hero.jpg',
      backgroundImageAlt: 'The congregation singing',
      internalNote: 'do not publish',
      memberIds: ['m1'],
    },
  });

  assert.deepEqual(section, {
    id: 'section-1',
    type: 'hero',
    order: 0,
    content: {
      variant: 'cover',
      headline: 'Welcome',
      backgroundImageUrl: 'https://cdn.example/hero.jpg',
      backgroundImageAlt: 'The congregation singing',
    },
  });
});

test('a public section tolerates content that is not an object', () => {
  assert.deepEqual(
    toPublicSection({ id: 's', type: 'giving', order: 3, content: null }).content,
    {},
  );
});

test('the public website exposes the live state, not the live switch or unknown settings', () => {
  const website = toPublicWebsite(
    {
      id: 'website-1',
      title: 'Grace Church',
      description: null,
      publishedAt: new Date('2026-09-01T00:00:00Z'),
      theme: { accent: '#ffffff', background: '#ffffff', extra: 'x' },
      settings: {
        template: 'city',
        timeZone: 'Europe/Kyiv',
        serviceTimes: [{ weekday: 0, time: '10:00', durationMinutes: 90 }],
        live: { mode: 'manual', isLive: true, url: 'https://youtube.com/live/abc', leadMinutes: 5 },
        internalFlag: true,
      },
      logoAssetId: 'asset-logo',
      organization: { name: 'Grace', slug: 'grace', id: 'org-1', status: 'ACTIVE' },
    },
    new Date('2026-09-21T12:00:00Z'),
  );

  assert.equal(website.settings.template, 'city');
  assert.deepEqual(website.settings.live, {
    url: 'https://youtube.com/live/abc',
    isLive: true,
    nextService: website.settings.live.nextService,
  });
  assert.equal(website.settings.live.nextService.weekday, 0);
  assert.equal('mode' in website.settings.live, false);
  assert.equal('internalFlag' in website.settings, false);
  assert.deepEqual(website.organization, { name: 'Grace', slug: 'grace', logoUrl: null });
  assert.equal('logoAssetId' in website, false);
  assert.equal('logoAssetId' in website.organization, false);
  assert.deepEqual(website.theme, { accent: '#ffffff', background: '#ffffff' });
  assert.equal(website.settings.seo.noindex, false);
  assert.equal(website.settings.seo.ogImageUrl, null);
});

test('the public website links its media to the api instead of publishing a signed url', async () => {
  const service = new WebsitesService(
    { findPublicWebsite: async () => storedWebsite() },
    mediaService(),
  );

  const website = await service.findPublicWebsite('grace');

  assert.equal(website.organization.logoUrl, mediaUrl(LOGO_ASSET));
  assert.equal(website.settings.seo.ogImageUrl, mediaUrl(WEBSITE_OG_ASSET));
  assert.equal(JSON.stringify(website).includes('X-Amz-Signature'), false);
});

test('a public page links its og image and its section backgrounds to the api', async () => {
  const service = new PagesService({ findPublicPage: async () => storedPage() }, mediaService());

  const page = await service.findPublicPage('grace', 'home');

  assert.equal(page.seo.ogImageUrl, mediaUrl(PAGE_OG_ASSET));
  assert.equal(page.sections[0].content.backgroundImageUrl, mediaUrl(BACKGROUND_ASSET));
  assert.equal(page.website.organization.logoUrl, mediaUrl(LOGO_ASSET));
  assert.equal(page.website.settings.seo.ogImageUrl, mediaUrl(WEBSITE_OG_ASSET));
  assert.equal(JSON.stringify(page).includes('X-Amz-Signature'), false);
});

test('a published link carries the reference exactly as the website stored it', async () => {
  const uppercase = '1111111A-1111-4111-8111-000000000005';
  const page = { ...storedPage(), seo: { ogImageAssetId: uppercase } };
  const service = new PagesService(
    { findPublicPage: async () => page },
    mediaService([uppercase, LOGO_ASSET, WEBSITE_OG_ASSET, BACKGROUND_ASSET]),
  );

  const published = await service.findPublicPage('grace', 'home');

  // Canonicalizing the case here would publish a link the media route cannot trace back to the
  // reference, because a reference inside a json document is compared as text.
  assert.equal(published.seo.ogImageUrl, mediaUrl(uppercase));
});

test('media the organization no longer owns leaves the page without an image, not a dead link', async () => {
  const websites = new WebsitesService(
    { findPublicWebsite: async () => storedWebsite() },
    mediaService([]),
  );
  const pages = new PagesService({ findPublicPage: async () => storedPage() }, mediaService([]));

  const website = await websites.findPublicWebsite('grace');
  const page = await pages.findPublicPage('grace', 'home');

  assert.equal(website.organization.logoUrl, null);
  assert.equal(website.settings.seo.ogImageUrl, null);
  assert.equal(page.seo.ogImageUrl, null);
  assert.equal('backgroundImageUrl' in page.sections[0].content, false);
});

test('the owner preview keeps signed urls, because the public media route refuses draft content', async () => {
  const draft = {
    ...storedPage(),
    sections: [
      ...storedPage().sections,
      {
        id: 'section-2',
        type: 'about',
        order: 1,
        hidden: true,
        content: { variant: 'cards', title: 'Hidden' },
      },
    ],
    website: { ...storedWebsite(), publishedAt: null },
  };
  const service = new PagesService({ findDashboardPage: async () => draft }, mediaService());

  const preview = await service.findPreviewPage(ORG_ID, 'page-1');

  assert.match(preview.seo.ogImageUrl, /X-Amz-Signature/u);
  assert.match(preview.sections[0].content.backgroundImageUrl, /X-Amz-Signature/u);
  assert.match(preview.website.organization.logoUrl, /X-Amz-Signature/u);
  assert.equal(JSON.stringify(preview).includes('/public/website-media/'), false);
  assert.deepEqual(
    preview.sections.map((section) => section.id),
    ['section-1'],
  );
});

test('settings that fail the schema fall back to defaults instead of breaking the site', () => {
  const website = toPublicWebsite({
    id: 'w',
    title: 'x',
    description: null,
    publishedAt: null,
    theme: 'oops',
    settings: { template: 'unknown-template' },
    organization: { name: 'x', slug: 'x' },
  });

  assert.equal(website.settings.template, 'default');
  assert.equal(website.theme.accent, '#1f883d');
});
