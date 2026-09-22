import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inertStyleControls,
  templateReadsStyleControl,
} from '../apps/web/app/(dashboard)/dashboard/[orgId]/website/website-template-fields.ts';

test('the city template reads neither the theme background nor a section font preset', () => {
  assert.deepEqual(inertStyleControls('city'), ['themeBackground', 'sectionFontPreset']);
  assert.equal(templateReadsStyleControl('city', 'themeBackground'), false);
  assert.equal(templateReadsStyleControl('city', 'sectionFontPreset'), false);
});

test('the classic template reads both, so neither control is hidden', () => {
  assert.deepEqual(inertStyleControls('default'), []);
  assert.equal(templateReadsStyleControl('default', 'themeBackground'), true);
  assert.equal(templateReadsStyleControl('default', 'sectionFontPreset'), true);
});
