const assert = require('node:assert/strict');
const test = require('node:test');
const {
  NotificationsRepository,
} = require('../dist/modules/notifications/repositories/notifications.repository');

const CUTOFF = new Date('2026-02-22T03:30:00.000Z');

function repositoryWithDeletes(deleteCounts) {
  const calls = [];
  const prisma = {
    $executeRaw: async (strings, ...values) => {
      calls.push(values);
      return deleteCounts[calls.length - 1] ?? 0;
    },
  };

  return { repository: new NotificationsRepository(prisma), calls };
}

test('stops purging as soon as a batch comes back short', async () => {
  const { repository, calls } = repositoryWithDeletes([120]);

  const result = await repository.purgeExpired({
    cutoff: CUTOFF,
    onlyDismissed: false,
    batchSize: 5000,
    maxBatches: 200,
  });

  assert.deepEqual(result, { deletedCount: 120, batches: 1, exhausted: false });
  assert.equal(calls.length, 1);
});

test('keeps purging while batches come back full', async () => {
  const { repository, calls } = repositoryWithDeletes([5000, 5000, 400]);

  const result = await repository.purgeExpired({
    cutoff: CUTOFF,
    onlyDismissed: false,
    batchSize: 5000,
    maxBatches: 200,
  });

  assert.deepEqual(result, { deletedCount: 10_400, batches: 3, exhausted: false });
  assert.equal(calls.length, 3);
});

test('reports an exhausted run when the batch limit is reached', async () => {
  const { repository, calls } = repositoryWithDeletes([100, 100, 100, 100]);

  const result = await repository.purgeExpired({
    cutoff: CUTOFF,
    onlyDismissed: false,
    batchSize: 100,
    maxBatches: 3,
  });

  assert.deepEqual(result, { deletedCount: 300, batches: 3, exhausted: true });
  assert.equal(calls.length, 3);
});

test('passes the cutoff as a UTC string so the comparison ignores the process time zone', async () => {
  const { repository, calls } = repositoryWithDeletes([0]);

  await repository.purgeExpired({
    cutoff: CUTOFF,
    onlyDismissed: false,
    batchSize: 5000,
    maxBatches: 200,
  });

  assert.ok(calls[0].includes('2026-02-22T03:30:00.000Z'));
});
