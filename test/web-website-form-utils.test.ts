import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatServiceTimes,
  navigationAppendInput,
  pageInput,
  parseLinks,
  parseServiceTimes,
  sectionInput,
  websiteSettingsInput,
} from '../apps/web/app/(dashboard)/dashboard/[orgId]/website/website-form-utils.ts';

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

test('service times parse weekday names or numbers and round-trip through the textarea', () => {
  const parsed = parseServiceTimes('sun 10:00 | 90 | Sunday service\n3 19:00\nbad line\nmon 25:00');

  assert.deepEqual(parsed, [
    { weekday: 0, time: '10:00', durationMinutes: 90, label: 'Sunday service' },
    { weekday: 3, time: '19:00', durationMinutes: 90 },
  ]);
  assert.equal(formatServiceTimes(parsed), 'sun 10:00 | 90 | Sunday service\nwed 19:00 | 90');
});

test('links need both a label and an href', () => {
  assert.deepEqual(parseLinks('Give | /give\nBroken\n | /x\nYouTube | https://youtube.com/c'), [
    { label: 'Give', href: '/give' },
    { label: 'YouTube', href: 'https://youtube.com/c' },
  ]);
});

test('a hero stores its title and text as headline and subheading', () => {
  const section = sectionInput(
    form({
      type: 'hero',
      variant: 'cover',
      order: '0',
      title: 'Welcome',
      body: 'Come in',
      hidden: 'true',
    }),
  );

  assert.equal(section.type, 'hero');
  assert.equal(section.hidden, true);
  assert.deepEqual(section.content, {
    variant: 'cover',
    headline: 'Welcome',
    subheading: 'Come in',
  });
});

test('giving ways and footer links come from their line textareas', () => {
  const giving = sectionInput(
    form({ type: 'giving', variant: 'cover', order: '3', ways: 'Card | Monthly\nCash |' }),
  );
  assert.deepEqual(giving.content?.['ways'], [{ label: 'Card', value: 'Monthly' }]);

  const footer = sectionInput(
    form({ type: 'footer', variant: 'columns', order: '4', links: 'About | /about' }),
  );
  assert.deepEqual(footer.content?.['links'], [{ label: 'About', href: '/about' }]);
});

test('an unknown section type falls back to hero rather than failing', () => {
  assert.equal(sectionInput(form({ type: 'nope', order: '0' })).type, 'hero');
});

test('website settings read the live switch, locale and navigation from the form', () => {
  const input = websiteSettingsInput(
    form({
      title: 'Grace',
      accent: '#ffffff',
      locale: 'uk',
      timeZone: 'Europe/Kyiv',
      navigation: 'Give | /give',
      liveMode: 'manual',
      isLive: 'true',
      leadMinutes: '10',
      noindex: 'true',
    }),
  );

  assert.equal(input.settings?.locale, 'uk');
  assert.equal(input.settings?.timeZone, 'Europe/Kyiv');
  assert.deepEqual(input.settings?.navigation, [{ label: 'Give', href: '/give' }]);
  assert.deepEqual(input.settings?.live, {
    url: undefined,
    mode: 'manual',
    isLive: true,
    leadMinutes: 10,
  });
  assert.equal(input.settings?.seo?.noindex, true);
  assert.equal(input.theme?.accent, '#ffffff');
});

test('saving settings keeps the stored OG image unless its removal was requested', () => {
  const kept = websiteSettingsInput(form({ title: 'Grace', ogImageAssetId: 'asset-1' }));
  assert.equal(kept.settings?.seo?.ogImageAssetId, 'asset-1');

  const removed = websiteSettingsInput(
    form({ title: 'Grace', ogImageAssetId: 'asset-1', removeOgImage: 'true' }),
  );
  assert.equal(removed.settings?.seo?.ogImageAssetId, undefined);

  const none = websiteSettingsInput(form({ title: 'Grace', ogImageAssetId: '' }));
  assert.equal(none.settings?.seo?.ogImageAssetId, undefined);
});

test('a page keeps, drops or replaces its OG image the same way', () => {
  const base = { slug: 'about', title: 'About', status: 'DRAFT', seoTitle: 'About us' };

  const kept = pageInput(form({ ...base, ogImageAssetId: 'asset-1' }));
  assert.deepEqual(kept.seo, {
    title: 'About us',
    description: undefined,
    noindex: false,
    ogImageAssetId: 'asset-1',
  });

  const removed = pageInput(form({ ...base, ogImageAssetId: 'asset-1', removeOgImage: 'true' }));
  assert.equal(removed.seo?.ogImageAssetId, undefined);

  // The upload helper rewrites the hidden id to the freshly confirmed asset before submit.
  const replaced = pageInput(form({ ...base, ogImageAssetId: 'asset-2' }));
  assert.equal(replaced.seo?.ogImageAssetId, 'asset-2');
});

test('a page carries a known starter preset and ignores anything else', () => {
  const base = { slug: 'about', title: 'About', status: 'DRAFT' };

  assert.equal(pageInput(form({ ...base, preset: 'contacts' })).preset, 'contacts');
  assert.equal(pageInput(form({ ...base, preset: 'nope' })).preset, undefined);
  assert.equal(pageInput(form({ ...base, preset: '' })).preset, undefined);
  assert.equal(pageInput(form(base)).preset, undefined);
});

test('adding a page to the menu appends its link to the stored navigation', () => {
  const result = navigationAppendInput(
    form({
      addToMenu: 'true',
      websiteTitle: 'Grace',
      websiteDescription: 'A church',
      navigation: 'Give | /give',
    }),
    { slug: 'about', title: 'About us' },
  );

  assert.equal(result.status, 'ready');
  assert.equal(result.status === 'ready' ? result.settings.title : '', 'Grace');
  assert.equal(result.status === 'ready' ? result.settings.description : '', 'A church');
  assert.deepEqual(result.status === 'ready' ? result.settings.settings?.navigation : [], [
    { label: 'Give', href: '/give' },
    { label: 'About us', href: '/about' },
  ]);
});

test('the menu is left alone when it was not requested or already holds the page', () => {
  assert.equal(
    navigationAppendInput(form({ websiteTitle: 'Grace' }), { slug: 'about', title: 'About' })
      .status,
    'skipped',
  );
  assert.equal(
    navigationAppendInput(
      form({ addToMenu: 'true', websiteTitle: 'Grace', navigation: 'About | /about' }),
      { slug: 'about', title: 'About us' },
    ).status,
    'skipped',
  );
});

test('a full menu reports itself instead of dropping a link', () => {
  const navigation = Array.from({ length: 10 }, (_, index) => `Link ${index} | /p${index}`).join(
    '\n',
  );

  assert.equal(
    navigationAppendInput(form({ addToMenu: 'true', websiteTitle: 'Grace', navigation }), {
      slug: 'about',
      title: 'About',
    }).status,
    'menu-full',
  );
});
