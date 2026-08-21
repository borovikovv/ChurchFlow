const assert = require('node:assert/strict');
const test = require('node:test');
const { NotificationsService } = require('../dist/modules/notifications/notifications.service');

const CUTOFFS = {
  read: new Date('2026-02-22T03:30:00.000Z'),
  all: new Date('2025-08-21T03:30:00.000Z'),
};

function serviceWith(repositoryOverrides) {
  const countCalls = [];
  const purgeCalls = [];
  const repository = {
    countExpired: async (input) => {
      countCalls.push(input);
      return repositoryOverrides.count ?? 0;
    },
    purgeExpired: async (input) => {
      purgeCalls.push(input);
      return repositoryOverrides.purge ?? { deletedCount: 0, batches: 1, exhausted: false };
    },
  };

  return {
    service: new NotificationsService(repository, {}, {}, {}),
    countCalls,
    purgeCalls,
  };
}

test('dry run counts both tiers and deletes nothing', async () => {
  const { service, countCalls, purgeCalls } = serviceWith({ count: 42 });

  const result = await service.purgeExpiredNotifications({ cutoffs: CUTOFFS, dryRun: true });

  assert.equal(purgeCalls.length, 0);
  assert.equal(countCalls.length, 2);
  assert.deepEqual(result, { dryRun: true, dismissedCount: 42, allCount: 42 });
});

test('dry run excludes rows the dismissed tier already covers from the global count', async () => {
  const { service, countCalls } = serviceWith({ count: 0 });

  await service.purgeExpiredNotifications({ cutoffs: CUTOFFS, dryRun: true });

  assert.deepEqual(countCalls[0], { cutoff: CUTOFFS.read, onlyDismissed: true });
  assert.deepEqual(countCalls[1], {
    cutoff: CUTOFFS.all,
    onlyDismissed: false,
    excludeDismissedBefore: CUTOFFS.read,
  });
});

test('real run purges both tiers with their own cutoffs', async () => {
  const { service, countCalls, purgeCalls } = serviceWith({
    purge: { deletedCount: 7, batches: 1, exhausted: false },
  });

  const result = await service.purgeExpiredNotifications({ cutoffs: CUTOFFS, dryRun: false });

  assert.equal(countCalls.length, 0);
  assert.equal(purgeCalls.length, 2);
  assert.equal(purgeCalls[0].cutoff, CUTOFFS.read);
  assert.equal(purgeCalls[0].onlyDismissed, true);
  assert.equal(purgeCalls[1].cutoff, CUTOFFS.all);
  assert.equal(purgeCalls[1].onlyDismissed, false);
  assert.deepEqual(result, { dryRun: false, dismissedCount: 7, allCount: 7 });
});
