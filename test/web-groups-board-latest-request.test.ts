import assert from 'node:assert/strict';
import test from 'node:test';
import { createLatestRequest } from '../apps/web/app/(dashboard)/dashboard/[orgId]/groups/_components/board/latest-request.ts';

test('only the most recently started request counts as latest', () => {
  const requests = createLatestRequest();
  const first = requests.begin();
  const second = requests.begin();

  assert.equal(requests.isLatest(first), false);
  assert.equal(requests.isLatest(second), true);
});

test('an older answer arriving after a newer one is still stale', () => {
  const requests = createLatestRequest();
  const older = requests.begin();
  const newer = requests.begin();

  // The newer answer is applied first, then the older one comes back late.
  assert.equal(requests.isLatest(newer), true);
  assert.equal(requests.isLatest(older), false);
});

test('separate trackers do not interfere', () => {
  const left = createLatestRequest();
  const right = createLatestRequest();
  const leftId = left.begin();
  right.begin();
  right.begin();

  assert.equal(left.isLatest(leftId), true);
});
