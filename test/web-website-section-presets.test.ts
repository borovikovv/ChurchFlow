import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sectionFieldGroups,
  sectionVariant,
  sectionVariantChoices,
  sectionVariantsForTemplate,
} from '../apps/web/app/(dashboard)/dashboard/[orgId]/website/website-section-presets.ts';

const variantKeys = (template: 'city' | 'default') =>
  sectionVariantsForTemplate(template).map(
    (definition) => `${definition.type}:${definition.variant}`,
  );

test('the city template offers the inner-page sections and the second variants', () => {
  const keys = variantKeys('city');

  assert.deepEqual(keys, [
    'hero:cover',
    'hero:split',
    'about:text',
    'about:columns',
    'live:banner',
    'schedule:location',
    'giving:cover',
    'giving:ways',
    'contact:details',
    'footer:columns',
  ]);
});

test('the classic template keeps exactly the variants it had', () => {
  assert.deepEqual(variantKeys('default'), ['hero:hero', 'contact:contact', 'contact:footer']);
});

test('the new variants resolve to their own field groups', () => {
  assert.deepEqual(sectionFieldGroups({ type: 'hero', content: { variant: 'split' } }, 'city'), [
    'eyebrow',
    'titleBody',
    'buttons',
    'background',
  ]);

  assert.ok(
    sectionFieldGroups({ type: 'about', content: { variant: 'columns' } }, 'city').includes(
      'items',
    ),
  );

  assert.deepEqual(
    sectionFieldGroups({ type: 'contact', content: { variant: 'details' } }, 'city'),
    ['eyebrow', 'titleBody', 'contact', 'buttons'],
  );
});

test('a stored variant survives a save under a template that does not define it', () => {
  // A classic schedule section, with its variant stored and with none at all, opened under the city
  // template: the form posts the variant back, so it has to stay the one the section already has.
  const stored = { type: 'schedule' as const, content: { variant: 'schedule' } };
  assert.equal(sectionVariant(stored), 'schedule');
  assert.deepEqual(sectionVariantChoices(stored, 'city'), [
    { variant: 'location', renderable: true },
    { variant: 'schedule', renderable: false },
  ]);

  const withoutVariant = { type: 'schedule' as const, content: {} };
  assert.equal(sectionVariant(withoutVariant), 'schedule');
  assert.deepEqual(sectionVariantChoices(withoutVariant, 'city'), [
    { variant: 'location', renderable: true },
    { variant: 'schedule', renderable: false },
  ]);

  const city = { type: 'schedule' as const, content: { variant: 'location' } };
  assert.equal(sectionVariant(city), 'location');
  assert.deepEqual(sectionVariantChoices(city, 'city'), [
    { variant: 'location', renderable: true },
  ]);
});

test('the variant choices offer only what the active template renders', () => {
  assert.deepEqual(sectionVariantChoices({ type: 'hero', content: { variant: 'cover' } }, 'city'), [
    { variant: 'cover', renderable: true },
    { variant: 'split', renderable: true },
  ]);

  // The classic hero variant is shown as the current one, but it is not offered as a choice.
  assert.deepEqual(sectionVariantChoices({ type: 'hero', content: { variant: 'hero' } }, 'city'), [
    { variant: 'cover', renderable: true },
    { variant: 'split', renderable: true },
    { variant: 'hero', renderable: false },
  ]);

  // A section type the active template cannot render at all keeps its own variant and nothing else.
  assert.deepEqual(
    sectionVariantChoices({ type: 'gallery', content: { variant: 'events' } }, 'city'),
    [{ variant: 'events', renderable: false }],
  );
  assert.deepEqual(
    sectionVariantChoices({ type: 'about', content: { variant: 'connect' } }, 'default'),
    [{ variant: 'connect', renderable: false }],
  );
});

test('the field groups come from the active template, never from the one a variant belongs to', () => {
  // A classic footer section opened under the city template: the city contact renderer reads neither
  // the social links nor the copyright line, so neither is offered.
  assert.deepEqual(
    sectionFieldGroups({ type: 'contact', content: { variant: 'footer' } }, 'city'),
    ['eyebrow', 'titleBody', 'contact', 'buttons'],
  );

  // And the other way round: a city hero opened under the classic template.
  assert.deepEqual(sectionFieldGroups({ type: 'hero', content: { variant: 'cover' } }, 'default'), [
    'font',
    'titleBody',
    'buttons',
    'background',
  ]);
});

test('a variant no template defines still resolves to editable field groups', () => {
  assert.deepEqual(
    sectionFieldGroups({ type: 'schedule', content: { variant: 'schedule' } }, 'city'),
    ['eyebrow', 'titleBody', 'buttons', 'background'],
  );

  assert.deepEqual(sectionFieldGroups({ type: 'gallery', content: {} }, 'city'), [
    'titleBody',
    'buttons',
    'background',
  ]);
  assert.deepEqual(
    sectionFieldGroups({ type: 'about', content: { variant: 'connect' } }, 'default'),
    ['titleBody', 'buttons', 'background'],
  );
});
