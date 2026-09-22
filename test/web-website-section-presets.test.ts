import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sectionDefinition,
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
  const split = sectionDefinition({ type: 'hero', content: { variant: 'split' } }, 'city');
  assert.deepEqual(split.fields, ['eyebrow', 'titleBody', 'buttons', 'background']);

  const columns = sectionDefinition({ type: 'about', content: { variant: 'columns' } }, 'city');
  assert.ok(columns.fields.includes('items'));

  const details = sectionDefinition({ type: 'contact', content: { variant: 'details' } }, 'city');
  assert.deepEqual(details.fields, ['titleBody', 'contact', 'buttons']);
});
