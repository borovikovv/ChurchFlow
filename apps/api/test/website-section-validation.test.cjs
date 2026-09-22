const assert = require('node:assert/strict');
const test = require('node:test');
const {
  PUBLIC_SECTION_TYPES,
  WEBSITE_SECTION_MODULES,
  WEBSITE_SECTION_SOURCE_MAX_LIMIT,
  WEBSITE_SECTION_SOURCE_MAX_REFS,
  WEBSITE_TEMPLATE_DEFINITIONS,
  isSafeWebsiteUrl,
  publicWebsiteSectionKeys,
  readWebsiteSectionSource,
  updateWebsiteSettingsSchema,
  upsertWebsitePageSchema,
  upsertWebsiteSectionSchema,
  websiteSectionContentSchema,
  websiteSettingsSchema,
} = require('@churchflow/shared');

const eventRef = '11111111-1111-4111-8111-111111111111';

function issuePaths(result) {
  return result.error.issues.map((issue) => issue.path.join('.'));
}

test('safe website urls: relative paths, anchors, contact schemes and http(s)', () => {
  for (const value of [
    '/give',
    '#live',
    'mailto:hi@church.org',
    'tel:+380441234567',
    'https://youtube.com/live/x',
  ]) {
    assert.equal(isSafeWebsiteUrl(value), true, value);
  }
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,x',
    '//evil.example',
    'ftp://x',
    '',
    '   ',
  ]) {
    assert.equal(isSafeWebsiteUrl(value), false, value);
  }
});

test('a section with a javascript: link is rejected on every href-like key', () => {
  const result = upsertWebsiteSectionSchema.safeParse({
    type: 'hero',
    order: 0,
    content: {
      headline: 'Welcome',
      primaryHref: 'javascript:alert(1)',
      customLinkUrl: 'data:text/html,x',
    },
  });

  assert.equal(result.success, false);
  const paths = issuePaths(result);
  assert.ok(paths.includes('content.primaryHref'), paths.join(', '));
  assert.ok(paths.includes('content.customLinkUrl'), paths.join(', '));
});

test('a valid section is trimmed, keeps legacy keys and defaults hidden to false', () => {
  const result = upsertWebsiteSectionSchema.safeParse({
    type: 'contact',
    order: 2,
    content: {
      variant: 'footer',
      title: '  Church name  ',
      socialInstagramHref: 'https://instagram.com/church',
      legacyKey: 'kept',
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.data.hidden, false);
  assert.equal(result.data.content.title, 'Church name');
  assert.equal(result.data.content.legacyKey, 'kept');
});

test('content that does not match its section type is rejected with a content path', () => {
  const result = upsertWebsiteSectionSchema.safeParse({
    type: 'giving',
    order: 0,
    content: { ways: [{ label: 'Card' }] },
  });

  assert.equal(result.success, false);
  assert.ok(issuePaths(result).includes('content.ways.0.value'));
});

test('a section saved without a source round-trips unchanged', () => {
  const content = { variant: 'cards', title: 'Our ministries' };
  const result = upsertWebsiteSectionSchema.safeParse({ type: 'about', order: 0, content });

  assert.equal(result.success, true);
  assert.deepEqual(result.data.content, content);
  assert.equal('source' in result.data.content, false);
  assert.deepEqual(readWebsiteSectionSource(result.data.content), { mode: 'manual' });
});

test('a churchflow source keeps its module, its references and its display limit', () => {
  const source = { mode: 'churchflow', module: 'events', refs: [eventRef], limit: 3 };
  const result = upsertWebsiteSectionSchema.safeParse({
    type: 'about',
    order: 0,
    content: { title: 'Upcoming events', source },
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data.content.source, source);
  assert.deepEqual(readWebsiteSectionSource(result.data.content), source);
});

test('every module the parent ticket names is accepted as a source module', () => {
  for (const module of WEBSITE_SECTION_MODULES) {
    const result = upsertWebsiteSectionSchema.safeParse({
      type: 'about',
      order: 0,
      content: { source: { mode: 'churchflow', module } },
    });

    assert.equal(result.success, true, module);
  }
});

test('a malformed source is rejected with a content.source path', () => {
  const sources = [
    { mode: 'churchflow' },
    { mode: 'churchflow', module: 'calendar' },
    { mode: 'churchflow', module: 'events', refs: ['event-1'] },
    {
      mode: 'churchflow',
      module: 'events',
      refs: Array.from({ length: WEBSITE_SECTION_SOURCE_MAX_REFS + 1 }, () => eventRef),
    },
    { mode: 'churchflow', module: 'events', limit: 0 },
    { mode: 'churchflow', module: 'events', limit: WEBSITE_SECTION_SOURCE_MAX_LIMIT + 1 },
    { mode: 'churchflow', module: 'events', memberIds: ['member-1'] },
    { mode: 'manual', module: 'events' },
    { mode: 'external' },
    'events',
  ];

  for (const source of sources) {
    const result = upsertWebsiteSectionSchema.safeParse({
      type: 'about',
      order: 0,
      content: { source },
    });

    assert.equal(result.success, false, JSON.stringify(source));
    assert.ok(
      issuePaths(result).some((path) => path.startsWith('content.source')),
      JSON.stringify(source),
    );
  }
});

test('no section type publishes its asset id or its data source', () => {
  for (const type of PUBLIC_SECTION_TYPES) {
    const keys = publicWebsiteSectionKeys(type);

    assert.equal(keys.includes('source'), false, type);
    assert.equal(keys.includes('backgroundImageAssetId'), false, type);
  }
});

test('stored settings written before the typed schema normalize with defaults filled in', () => {
  const settings = websiteSettingsSchema.parse({ template: 'default' });

  assert.equal(settings.template, 'default');
  assert.equal(settings.timeZone, 'UTC');
  assert.deepEqual(settings.navigation, []);
  assert.deepEqual(settings.serviceTimes, []);
  assert.equal(settings.live.mode, 'schedule');
  assert.equal(settings.live.isLive, false);
  assert.equal(settings.seo.noindex, false);
});

test('a settings update is a patch: absent keys stay undefined, present ones are validated', () => {
  const result = updateWebsiteSettingsSchema.safeParse({
    title: 'Grace Church',
    settings: { template: 'city', live: { url: 'https://youtube.com/live/x' } },
  });

  assert.equal(result.success, true);
  assert.equal(result.data.settings.template, 'city');
  assert.equal(result.data.settings.navigation, undefined);
  assert.equal(result.data.settings.live.mode, 'schedule');
  assert.deepEqual(result.data.theme, {});
});

test('an unknown template id, a bad colour and an unsafe live url are rejected', () => {
  assert.equal(
    updateWebsiteSettingsSchema.safeParse({ title: 'x', settings: { template: 'unknown' } })
      .success,
    false,
  );
  assert.equal(
    updateWebsiteSettingsSchema.safeParse({ title: 'x', theme: { accent: 'red' } }).success,
    false,
  );
  assert.equal(
    updateWebsiteSettingsSchema.safeParse({
      title: 'x',
      settings: { live: { url: 'javascript:alert(1)' } },
    }).success,
    false,
  );
});

test('page seo keeps title/description and defaults noindex to false', () => {
  const result = upsertWebsitePageSchema.safeParse({
    slug: 'home',
    title: 'Home',
    seo: { title: 'Grace Church', description: 'A church for the whole city' },
  });

  assert.equal(result.success, true);
  assert.equal(result.data.seo.noindex, false);
  assert.equal(result.data.seo.title, 'Grace Church');
});

test('every template section ships content that passes its own type schema', () => {
  for (const template of Object.values(WEBSITE_TEMPLATE_DEFINITIONS)) {
    for (const section of template.home) {
      assert.ok(
        template.sectionTypes.includes(section.type),
        `${template.id}: ${section.type} is not renderable by the template`,
      );
      const result = websiteSectionContentSchema(section.type).safeParse({
        variant: section.variant,
        ...section.content,
      });
      assert.equal(
        result.success,
        true,
        `${template.id}/${section.type}: ${JSON.stringify(result.error?.issues)}`,
      );
    }
  }
});
