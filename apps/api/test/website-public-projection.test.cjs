const assert = require('node:assert/strict');
const test = require('node:test');
const { toPublicSection, toPublicWebsite } = require('../dist/modules/websites/public-website.js');

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
