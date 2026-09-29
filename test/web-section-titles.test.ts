import assert from 'node:assert/strict';
import test from 'node:test';
import { sectionTitle } from '../apps/web/src/components/sections/types.ts';

test('a section keeps its own title', () => {
  assert.equal(sectionTitle({ title: 'Who we are' }, 'about', undefined), 'Who we are');
});

test('an untitled section falls back to the default for its type', () => {
  assert.equal(sectionTitle({}, 'giving', undefined), 'Giving');
  assert.equal(sectionTitle({ title: '  ' }, 'about', undefined), 'About');
});

test('the default title follows the website locale', () => {
  const website = { title: 'Grace', description: null, settings: { locale: 'uk' as const } };

  assert.equal(sectionTitle({}, 'contact', website), 'Контакти');
  assert.equal(sectionTitle({}, 'schedule', website), 'Розклад');
});
