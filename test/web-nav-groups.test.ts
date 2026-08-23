import assert from 'node:assert/strict';
import test from 'node:test';
import { navItemsInGroup } from '../apps/web/src/lib/nav-groups.ts';

const items = [
  { href: '/dashboard/1', group: 'primary' as const },
  { href: '/dashboard/1/profile', group: 'account' as const },
  { href: '/dashboard/1/members', group: 'primary' as const },
  { href: '/dashboard/1/prayer-requests', group: 'more' as const },
];

test('each mobile surface takes only its own group', () => {
  assert.deepEqual(
    navItemsInGroup(items, 'primary').map((item) => item.href),
    ['/dashboard/1', '/dashboard/1/members'],
  );
  assert.deepEqual(
    navItemsInGroup(items, 'more').map((item) => item.href),
    ['/dashboard/1/prayer-requests'],
  );
  assert.deepEqual(
    navItemsInGroup(items, 'account').map((item) => item.href),
    ['/dashboard/1/profile'],
  );
});

test('the groups partition the list, so no item is dropped or shown twice', () => {
  const grouped = (['primary', 'more', 'account'] as const).flatMap((group) =>
    navItemsInGroup(items, group),
  );

  assert.equal(grouped.length, items.length);
  assert.equal(new Set(grouped.map((item) => item.href)).size, items.length);
});

test('config order is preserved inside a group', () => {
  assert.deepEqual(
    navItemsInGroup(items, 'primary'),
    items.filter((item) => item.group === 'primary'),
  );
});
