import assert from 'node:assert/strict';
import test from 'node:test';
import { isNavPathActive } from '../apps/web/src/lib/nav-active.ts';
import { displayNameInitials } from '../apps/web/src/lib/initials.ts';

test('a nav item matches its own path and nested routes', () => {
  assert.equal(isNavPathActive('/dashboard/1/members', '/dashboard/1/members'), true);
  assert.equal(isNavPathActive('/dashboard/1/members/42', '/dashboard/1/members'), true);
});

test('a nav item does not match a sibling route sharing its prefix', () => {
  assert.equal(isNavPathActive('/dashboard/1/members-archive', '/dashboard/1/members'), false);
});

test('an exact nav item ignores nested routes', () => {
  assert.equal(isNavPathActive('/dashboard/1', '/dashboard/1', true), true);
  assert.equal(isNavPathActive('/dashboard/1/members', '/dashboard/1', true), false);
});

test('initials take the first letter of the first two words', () => {
  assert.equal(displayNameInitials('Victoria Bonchuk'), 'VB');
  assert.equal(displayNameInitials('David'), 'D');
  assert.equal(displayNameInitials('Марія  Іваненко Петрівна'), 'МІ');
});

test('initials stay empty for a blank display name', () => {
  assert.equal(displayNameInitials('   '), '');
});
