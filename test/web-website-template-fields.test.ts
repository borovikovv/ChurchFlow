import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inertStyleControls,
  templateReadsStyleControl,
} from '../apps/web/app/(dashboard)/dashboard/[orgId]/website/website-template-fields.ts';

test('the city template reads none of the theme, font and section colour controls', () => {
  assert.deepEqual(inertStyleControls('city'), [
    'themeBackground',
    'sectionFontPreset',
    'sectionBackgroundColor',
  ]);
  assert.equal(templateReadsStyleControl('city', 'themeBackground'), false);
  assert.equal(templateReadsStyleControl('city', 'sectionFontPreset'), false);
  assert.equal(templateReadsStyleControl('city', 'sectionBackgroundColor'), false);
});

test('the classic template reads all of them, so no control is hidden', () => {
  assert.deepEqual(inertStyleControls('default'), []);
  assert.equal(templateReadsStyleControl('default', 'themeBackground'), true);
  assert.equal(templateReadsStyleControl('default', 'sectionFontPreset'), true);
  assert.equal(templateReadsStyleControl('default', 'sectionBackgroundColor'), true);
});
