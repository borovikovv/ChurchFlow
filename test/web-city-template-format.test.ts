import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cityMessages,
  cityTheme,
  formatNextService,
  formatServiceTime,
  isExternalHref,
  readCityItems,
  resolveWebsiteHref,
} from '../apps/web/src/components/sections/templates/city/city-format.ts';

const website = (settings: Record<string, unknown>, theme: Record<string, unknown> = {}) => ({
  title: 'Grace',
  description: null,
  theme,
  settings,
});

test('a white accent turns into ink on light sections and keeps white text on dark ones', () => {
  const theme = cityTheme(website({}, { accent: '#ffffff' }));
  assert.equal(theme.accent, '#ffffff');
  assert.equal(theme.onAccent, '#0a0a0a');
  assert.equal(theme.accentInk, '#0a0a0a');
  assert.equal(theme.onAccentInk, '#ffffff');
});

test('a dark brand accent is used as-is with white text on it', () => {
  const theme = cityTheme(website({}, { accent: '#1d5c57' }));
  assert.equal(theme.accentInk, '#1d5c57');
  assert.equal(theme.onAccent, '#ffffff');
});

test('short hex colours are read too', () => {
  assert.equal(cityTheme(website({}, { accent: '#fff' })).onAccent, '#0a0a0a');
});

test('template strings follow the website locale, falling back to English', () => {
  assert.equal(cityMessages(website({ locale: 'uk' })).liveNow, 'Зараз наживо');
  assert.equal(cityMessages(website({})).liveNow, 'Live now');
});

test('service times format as a localized weekday and the stored time', () => {
  assert.equal(formatServiceTime({ weekday: 0, time: '10:00' }, 'en'), 'Sunday · 10:00');
  assert.equal(formatServiceTime({ weekday: 3, time: '19:00' }, 'uk'), 'Середа · 19:00');
});

test('the next service is formatted in the website time zone and locale', () => {
  const nextService = {
    weekday: 0,
    time: '10:00',
    label: null,
    startsAt: '2026-09-20T07:00:00.000Z',
  };
  const formatted = formatNextService(
    nextService,
    website({ locale: 'uk', timeZone: 'Europe/Kyiv' }),
  );
  assert.match(formatted, /^Неділя, 20 вересня/);
  assert.match(formatted, /10:00$/);
});

test('internal links are resolved under the organization path, external ones untouched', () => {
  const site = website({}, {});
  const resolved = (href: string) =>
    resolveWebsiteHref(href, { ...site, organization: { name: 'Grace', slug: 'grace' } });

  assert.equal(resolved('/about'), '/o/grace/about');
  assert.equal(resolved('/'), '/o/grace');
  assert.equal(resolved('/o/grace/give'), '/o/grace/give');
  assert.equal(resolved('/o/grace#location'), '/o/grace#location');
  assert.equal(resolved('/o/grace?tab=live'), '/o/grace?tab=live');
  assert.equal(resolved('#live'), '#live');
  assert.equal(resolved('https://youtube.com/c'), 'https://youtube.com/c');
  assert.equal(resolved(''), '#');
  assert.equal(resolveWebsiteHref('/about', site), '/about');
});

test('about columns keep the items that have a title and drop the rest', () => {
  assert.deepEqual(
    readCityItems({
      items: [
        { title: 'The Bible', body: 'We read it together.' },
        { title: 'Community' },
        { body: 'No title, no card.' },
        'not an item',
        null,
      ],
    }),
    [
      { title: 'The Bible', body: 'We read it together.' },
      { title: 'Community', body: '' },
    ],
  );
  assert.deepEqual(readCityItems({}), []);
  assert.deepEqual(readCityItems({ items: 'nope' }), []);
});

test('only an absolute address counts as leaving the website', () => {
  assert.equal(isExternalHref('https://youtube.com/live'), true);
  assert.equal(isExternalHref('http://stream.test/x'), true);
  assert.equal(isExternalHref('//stream.test/x'), true);

  // An owner may type a section anchor or an inner page as the primary link, and neither of those
  // may end up on an anchor that opens a new tab.
  assert.equal(isExternalHref('#'), false);
  assert.equal(isExternalHref('#live'), false);
  assert.equal(isExternalHref('/o/grace/about'), false);
  assert.equal(isExternalHref(''), false);
});
