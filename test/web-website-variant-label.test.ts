import assert from 'node:assert/strict';
import test from 'node:test';
import { sectionVariantLabel } from '../apps/web/app/(dashboard)/dashboard/[orgId]/website/_components/section-variant-label.ts';

const KNOWN_VARIANTS = ['variants.cover', 'variants.columns'];

function translator() {
  const t = (key: string) => `name of ${key}`;

  return Object.assign(t, { has: (key: string) => KNOWN_VARIANTS.includes(key) });
}

test('a named variant is shown by its message', () => {
  assert.equal(sectionVariantLabel(translator(), 'cover'), 'name of variants.cover');
  assert.equal(sectionVariantLabel(translator(), 'columns'), 'name of variants.columns');
});

test('a variant no message names is shown as it is stored', () => {
  // Stored by a preset of another template, so the editor has no name of its own for it.
  assert.equal(sectionVariantLabel(translator(), 'quick-links'), 'quick-links');
  assert.equal(sectionVariantLabel(translator(), 'schedule'), 'schedule');
});
