const assert = require('node:assert/strict');
const test = require('node:test');
const {
  WEBSITE_TEMPLATE_DEFINITIONS,
  isSafeWebsiteUrl,
  updateWebsiteSettingsSchema,
  upsertWebsitePageSchema,
  upsertWebsiteSectionSchema,
  websiteSectionContentSchema,
} = require('@churchflow/shared');

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

test('website settings written before the typed schema still parse, with defaults filled in', () => {
  const result = updateWebsiteSettingsSchema.safeParse({
    title: 'Grace Church',
    theme: { accent: '#1f883d', background: '#ffffff' },
    settings: { template: 'default' },
  });

  assert.equal(result.success, true);
  assert.equal(result.data.settings.template, 'default');
  assert.deepEqual(result.data.settings.navigation, []);
  assert.deepEqual(result.data.settings.serviceTimes, []);
  assert.equal(result.data.settings.live.mode, 'schedule');
  assert.equal(result.data.settings.live.isLive, false);
  assert.equal(result.data.settings.seo.noindex, false);
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
