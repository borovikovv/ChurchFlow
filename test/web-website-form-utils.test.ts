import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inertSectionRows,
  inertSectionText,
  itemRows,
  linkRows,
  navigationAppendInput,
  pageInput,
  parseLinks,
  parseServiceTimes,
  repeaterRows,
  sectionInput,
  serviceTimeRow,
  serviceTimeRows,
  websiteSettingsInput,
} from '../apps/web/app/(dashboard)/dashboard/[orgId]/website/website-form-utils.ts';

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

// The structured editors post one value per row and field, so a form carries parallel lists.
function rowsForm(columns: Record<string, string[]>): FormData {
  const formData = new FormData();
  for (const [key, values] of Object.entries(columns)) {
    for (const value of values) formData.append(key, value);
  }
  return formData;
}

test('the line format still parses weekday names or numbers as the fallback path', () => {
  assert.deepEqual(
    parseServiceTimes('sun 10:00 | 90 | Sunday service\n3 19:00\nbad line\nmon 25:00'),
    [
      { weekday: 0, time: '10:00', durationMinutes: 90, label: 'Sunday service' },
      { weekday: 3, time: '19:00', durationMinutes: 90 },
    ],
  );
});

test('a submitted row keeps every value, separators and newlines included', () => {
  const posted = rowsForm({
    navigationLabel: ['Give | monthly', 'Watch\nlive'],
    navigationHref: ['/give', 'https://youtube.com/c'],
  });

  assert.deepEqual(repeaterRows(posted, ['navigationLabel', 'navigationHref']), [
    ['Give | monthly', '/give'],
    ['Watch\nlive', 'https://youtube.com/c'],
  ]);
});

test('a row whose later fields were left out still lines up with the first ones', () => {
  const posted = rowsForm({ itemTitle: ['Sunday', 'Prayer'], itemBody: ['Every week'] });

  assert.deepEqual(repeaterRows(posted, ['itemTitle', 'itemBody']), [
    ['Sunday', 'Every week'],
    ['Prayer', ''],
  ]);
});

test('a stored entry the line format could not describe loads into rows unchanged', () => {
  assert.deepEqual(linkRows([{ label: 'Give | monthly', href: '/give' }, { href: '/x' }]), [
    { label: 'Give | monthly', href: '/give' },
    { label: '', href: '/x' },
  ]);
  assert.deepEqual(itemRows([{ title: 'A | B', body: 'Line one\nLine two' }]), [
    { title: 'A | B', body: 'Line one\nLine two', label: '', href: '' },
  ]);
  assert.deepEqual(serviceTimeRows([{ weekday: 3, time: '19:00' }, 'nonsense']), [
    { weekday: '3', time: '19:00', durationMinutes: '90', label: '' },
  ]);
});

test('a service time row is only accepted with a real weekday, time and duration', () => {
  const valid = { weekday: '0', time: '10:00', durationMinutes: '90', label: 'Sunday | main' };
  assert.deepEqual(serviceTimeRow(valid), {
    weekday: 0,
    time: '10:00',
    durationMinutes: 90,
    label: 'Sunday | main',
  });
  assert.deepEqual(serviceTimeRow({ ...valid, label: '' }), {
    weekday: 0,
    time: '10:00',
    durationMinutes: 90,
  });
  assert.equal(serviceTimeRow({ ...valid, time: '25:00' }), null);
  assert.equal(serviceTimeRow({ ...valid, time: '' }), null);
  assert.equal(serviceTimeRow({ ...valid, weekday: '7' }), null);
  assert.equal(serviceTimeRow({ ...valid, durationMinutes: '10' }), null);
  assert.equal(serviceTimeRow({ ...valid, durationMinutes: '361' }), null);
  assert.equal(serviceTimeRow({ ...valid, durationMinutes: '' }), null);
});

test('settings read the menu and the service times from the submitted rows', () => {
  const posted = rowsForm({
    title: ['Grace'],
    navigationLabel: ['Give | monthly', 'Broken'],
    navigationHref: ['/give', ''],
    serviceTimeWeekday: ['0', '3'],
    serviceTimeTime: ['10:00', '19:00'],
    serviceTimeDuration: ['90', '60'],
    serviceTimeLabel: ['Sunday | main', ''],
  });
  const input = websiteSettingsInput(posted);

  assert.deepEqual(input.settings?.navigation, [{ label: 'Give | monthly', href: '/give' }]);
  assert.deepEqual(input.settings?.serviceTimes, [
    { weekday: 0, time: '10:00', durationMinutes: 90, label: 'Sunday | main' },
    { weekday: 3, time: '19:00', durationMinutes: 60 },
  ]);
});

test('a section reads its cards, giving ways and footer links from the submitted rows', () => {
  const posted = rowsForm({
    type: ['footer'],
    variant: ['columns'],
    order: ['0'],
    itemTitle: ['Sunday | 10:00', ''],
    itemBody: ['Main service', 'No title, so dropped'],
    itemLabel: ['', ''],
    itemHref: ['', ''],
    wayLabel: ['By card | monthly'],
    wayValue: ['IBAN UA | 123'],
    linkLabel: ['About | us'],
    linkHref: ['/about'],
  });
  const content = sectionInput(posted).content;

  assert.deepEqual(content?.['items'], [{ title: 'Sunday | 10:00', body: 'Main service' }]);
  assert.deepEqual(content?.['ways'], [{ label: 'By card | monthly', value: 'IBAN UA | 123' }]);
  assert.deepEqual(content?.['links'], [{ label: 'About | us', href: '/about' }]);
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

test('the background image, its asset id and its alt text travel together', () => {
  const values = {
    type: 'about',
    variant: 'text',
    order: '1',
    backgroundImageAssetId: '11111111-1111-4111-8111-111111111111',
    backgroundImageUrl: 'https://media.test/bg.jpg',
    backgroundImageAlt: 'The congregation singing',
  };

  assert.deepEqual(sectionInput(form(values)).content, {
    variant: 'text',
    backgroundImageAssetId: '11111111-1111-4111-8111-111111111111',
    backgroundImageUrl: 'https://media.test/bg.jpg',
    backgroundImageAlt: 'The congregation singing',
  });
  assert.deepEqual(sectionInput(form({ ...values, removeBackgroundImage: 'true' })).content, {
    variant: 'text',
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

const storedWebsite = (navigation: Array<{ label: string; href: string }>) => ({
  id: 'w',
  title: 'Grace Church',
  description: 'A church in the city',
  publishedAt: null,
  theme: { accent: '#ffffff', background: '#ffffff' },
  settings: {
    template: 'city' as const,
    timeZone: 'UTC',
    locale: 'en' as const,
    navigation,
    serviceTimes: [],
    location: {},
    live: { mode: 'schedule' as const, isLive: false, leadMinutes: 5 },
    socials: {},
    seo: { noindex: false, ogImageUrl: null },
  },
  organization: { name: 'Grace', slug: 'grace' },
});

// The settings patch replaces the title and description, so the append must be built from the
// website the action read back and never from values an editor could have sent.
test('adding a page to the menu appends its link to the stored navigation', () => {
  const result = navigationAppendInput(storedWebsite([{ label: 'Give', href: '/give' }]), {
    slug: 'about',
    title: 'About us',
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.status === 'ready' ? result.settings.title : '', 'Grace Church');
  assert.equal(
    result.status === 'ready' ? result.settings.description : '',
    'A church in the city',
  );
  assert.deepEqual(result.status === 'ready' ? result.settings.settings?.navigation : [], [
    { label: 'Give', href: '/give' },
    { label: 'About us', href: '/about' },
  ]);
});

test('the menu patch carries no theme or other settings keys to overwrite', () => {
  const result = navigationAppendInput(storedWebsite([]), { slug: 'about', title: 'About' });

  assert.deepEqual(result.status === 'ready' ? Object.keys(result.settings.settings ?? {}) : [], [
    'navigation',
  ]);
  assert.equal(result.status === 'ready' ? result.settings.theme : undefined, undefined);
});

test('a label holding a pipe survives, because the menu no longer round-trips through text', () => {
  const result = navigationAppendInput(
    storedWebsite([{ label: 'Give | monthly', href: '/give' }]),
    {
      slug: 'about',
      title: 'About | us',
    },
  );

  assert.deepEqual(result.status === 'ready' ? result.settings.settings?.navigation : [], [
    { label: 'Give | monthly', href: '/give' },
    { label: 'About | us', href: '/about' },
  ]);
});

test('a page already in the menu is not appended twice', () => {
  assert.equal(
    navigationAppendInput(storedWebsite([{ label: 'About', href: '/about' }]), {
      slug: 'about',
      title: 'About us',
    }).status,
    'skipped',
  );
});

test('a full menu reports itself instead of dropping a link', () => {
  const navigation = Array.from({ length: 10 }, (_, index) => ({
    label: `Link ${index}`,
    href: `/p${index}`,
  }));

  assert.equal(
    navigationAppendInput(storedWebsite(navigation), { slug: 'about', title: 'About' }).status,
    'menu-full',
  );
});

test('a stored value the form offers no input for travels back in a hidden input', () => {
  const content = {
    eyebrow: 'Who we are',
    backgroundColor: '#f6f8fa',
    fontPreset: 'montserrat-body',
    backgroundImageUrl: 'https://media.test/bg.jpg',
    primaryLabel: 'Give',
  };

  // The live banner offers no eyebrow and the city template hides the section background colour.
  assert.deepEqual(
    inertSectionText(content, ['live', 'buttons', 'background'], ['backgroundColor']),
    [
      { key: 'eyebrow', value: 'Who we are' },
      { key: 'backgroundColor', value: '#f6f8fa' },
      { key: 'fontPreset', value: 'montserrat-body' },
    ],
  );

  // With every group present and nothing hidden, the form itself carries all of it.
  assert.deepEqual(inertSectionText(content, ['font', 'eyebrow', 'buttons', 'background']), []);
});

test('a variant without a background group keeps the stored image instead of dropping it', () => {
  const content = {
    backgroundImageAssetId: '11111111-1111-4111-8111-111111111111',
    backgroundImageUrl: 'https://media.test/bg.jpg',
    backgroundImageAlt: 'The congregation singing',
  };

  assert.deepEqual(inertSectionText(content, ['titleBody', 'contact', 'copyright', 'links']), [
    { key: 'backgroundImageAssetId', value: '11111111-1111-4111-8111-111111111111' },
    { key: 'backgroundImageUrl', value: 'https://media.test/bg.jpg' },
    { key: 'backgroundImageAlt', value: 'The congregation singing' },
  ]);
});

test('a list the form offers no editor for is posted back row by row', () => {
  // A city footer, about-columns and giving section opened while the classic template is active: it
  // renders none of them, so the inspector falls back to the basic field groups and offers no list.
  const content = {
    links: [
      { label: 'About | us', href: '/about' },
      { label: 'Give', href: 'https://give.test/x' },
    ],
    items: [{ title: 'Sunday\n10:00', body: 'Main service', label: 'Read', href: '/sunday' }],
    ways: [{ label: 'By card', value: 'IBAN UA | 123' }],
  };
  const carried = inertSectionRows(content, ['titleBody', 'buttons', 'background']);

  // Every column posts one value per stored row, so the parallel lists stay the same length.
  assert.deepEqual(carried, [
    { name: 'itemTitle', values: ['Sunday\n10:00'] },
    { name: 'itemBody', values: ['Main service'] },
    { name: 'itemLabel', values: ['Read'] },
    { name: 'itemHref', values: ['/sunday'] },
    { name: 'wayLabel', values: ['By card'] },
    { name: 'wayValue', values: ['IBAN UA | 123'] },
    { name: 'linkLabel', values: ['About | us', 'Give'] },
    { name: 'linkHref', values: ['/about', 'https://give.test/x'] },
  ]);

  // Posted back through the form the inspector renders, a save keeps every list unchanged.
  const posted = new FormData();
  posted.set('type', 'footer');
  posted.set('variant', 'columns');
  posted.set('order', '0');
  posted.set('title', 'Church name');
  for (const column of carried) {
    for (const value of column.values) posted.append(column.name, value);
  }
  const saved = sectionInput(posted).content;

  assert.deepEqual(saved?.['links'], content.links);
  assert.deepEqual(saved?.['items'], content.items);
  assert.deepEqual(saved?.['ways'], content.ways);
});

test('a list the form does edit is left to its own editor', () => {
  const content = { ways: [{ label: 'By card', value: 'Monthly' }] };

  assert.deepEqual(inertSectionRows(content, ['eyebrow', 'titleBody', 'buttons', 'ways']), []);
  assert.deepEqual(inertSectionRows({}, ['titleBody']), []);
});
