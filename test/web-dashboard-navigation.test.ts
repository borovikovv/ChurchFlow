import assert from 'node:assert/strict';
import test from 'node:test';
import './support/web-module-hooks.ts';

const { dashboardNavigationItems } = await import('../apps/web/src/components/app-navigation.ts');
const { navItemsInGroup } = await import('../apps/web/src/lib/nav-groups.ts');

const ORG = 'org-1';
const LABELS = {
  budget: 'Budget',
  calendar: 'Calendar',
  groups: 'Groups',
  home: 'Home',
  knowledge: 'Knowledge',
  members: 'Members',
  prayerRequests: 'Prayers',
  profile: 'Profile',
  website: 'Website',
};
const DESCRIPTIONS = {
  budget: 'Budget description',
  groups: 'Groups description',
  knowledge: 'Knowledge description',
  prayerRequests: 'Prayers description',
  profile: 'Profile description',
  website: 'Website description',
};

const items = dashboardNavigationItems(ORG, {
  assistantEnabled: true,
  canOpenBudget: true,
  canOpenWebsite: true,
  descriptions: DESCRIPTIONS,
  labels: LABELS,
});

test('the desktop sidebar keeps its order', () => {
  assert.deepEqual(
    items.map((item) => item.label),
    [
      'Home',
      'Profile',
      'Members',
      'Groups',
      'Calendar',
      'Prayers',
      'Knowledge',
      'Budget',
      'Website',
    ],
  );
});

test('the mobile tab bar keeps Home, Members and Calendar, leaving room for the assistant', () => {
  assert.deepEqual(
    navItemsInGroup(items, 'primary').map((item) => item.label),
    ['Home', 'Members', 'Calendar'],
  );
});

test('Groups moves to the More sheet, directly above Prayers, with a description', () => {
  const moreItems = navItemsInGroup(items, 'more');

  assert.deepEqual(
    moreItems.map((item) => item.label),
    ['Groups', 'Prayers', 'Knowledge', 'Budget', 'Website'],
  );
  assert.equal(moreItems[0]?.description, 'Groups description');
});

test('without the assistant Groups keeps its tab', () => {
  const withoutAssistant = dashboardNavigationItems(ORG, {
    assistantEnabled: false,
    canOpenBudget: true,
    canOpenWebsite: true,
    descriptions: DESCRIPTIONS,
    labels: LABELS,
  });

  assert.deepEqual(
    navItemsInGroup(withoutAssistant, 'primary').map((item) => item.label),
    ['Home', 'Members', 'Groups', 'Calendar'],
  );
  assert.deepEqual(
    withoutAssistant.map((item) => item.label),
    items.map((item) => item.label),
  );
});
