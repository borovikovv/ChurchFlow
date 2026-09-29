import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLogoFile, validatePhotoFile } from '../apps/web/src/lib/validate-photo-file.ts';

const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'logo.svg', {
  type: 'image/svg+xml',
});

test('a logo may be an SVG', () => {
  assert.equal(validateLogoFile(svg), null);
});

test('a member photo still refuses an SVG', () => {
  assert.equal(validatePhotoFile(svg), 'Choose a JPEG, PNG, or WebP image.');
});

test('a logo refuses other file types', () => {
  const gif = new File(['GIF89a'], 'logo.gif', { type: 'image/gif' });

  assert.equal(validateLogoFile(gif), 'Choose a JPEG, PNG, WebP, or SVG image.');
});
