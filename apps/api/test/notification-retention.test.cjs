const assert = require('node:assert/strict');
const test = require('node:test');
const {
  resolveNotificationRetentionCutoffs,
} = require('../dist/modules/notifications/notification-retention');

const NOW = new Date('2026-08-21T03:30:00.000Z');

test('resolves both retention cutoffs from the configured windows', () => {
  const cutoffs = resolveNotificationRetentionCutoffs(NOW, {
    retentionDays: 365,
    readRetentionDays: 180,
  });

  assert.equal(cutoffs.all.toISOString(), '2025-08-21T03:30:00.000Z');
  assert.equal(cutoffs.read.toISOString(), '2026-02-22T03:30:00.000Z');
});

test('keeps the dismissed cutoff newer than the global one', () => {
  const cutoffs = resolveNotificationRetentionCutoffs(NOW, {
    retentionDays: 365,
    readRetentionDays: 180,
  });

  assert.ok(cutoffs.read.getTime() > cutoffs.all.getTime());
});

test('supports equal windows without drifting apart', () => {
  const cutoffs = resolveNotificationRetentionCutoffs(NOW, {
    retentionDays: 30,
    readRetentionDays: 30,
  });

  assert.equal(cutoffs.read.getTime(), cutoffs.all.getTime());
});
