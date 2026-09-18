import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatServiceTimes,
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
