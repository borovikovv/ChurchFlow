const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ALL_ENTITLEMENTS,
  ENTITLEMENTS,
  READ_ENTITLEMENTS,
  SUBSCRIPTION_STATUSES,
  hasEntitlement,
  resolveEntitlements,
} = require('@churchflow/shared');

const NOW = new Date('2026-09-01T12:00:00.000Z');
const TOMORROW = new Date('2026-09-02T12:00:00.000Z');
const YESTERDAY = new Date('2026-08-31T12:00:00.000Z');

const WRITE_ENTITLEMENTS = [
  ENTITLEMENTS.membersWrite,
  ENTITLEMENTS.calendarWrite,
  ENTITLEMENTS.prayersWrite,
  ENTITLEMENTS.websiteWrite,
  ENTITLEMENTS.filesUpload,
  ENTITLEMENTS.budgetWrite,
];

function subscription(overrides) {
  return {
    status: 'ACTIVE',
    isExempt: false,
    restrictAfter: null,
    graceEndsAt: null,
    ...overrides,
  };
}

function resolve(overrides, options) {
  return resolveEntitlements({
    subscription: overrides === null ? null : subscription(overrides),
    now: NOW,
    enforcementEnabled: true,
    ...options,
  });
}

function sorted(entitlements) {
  return [...entitlements].sort();
}

test('the kill switch grants everything, whatever the subscription says', () => {
  for (const status of SUBSCRIPTION_STATUSES) {
    const granted = resolve({ status }, { enforcementEnabled: false });
    assert.deepEqual(sorted(granted), sorted(ALL_ENTITLEMENTS));
  }

  const withoutRow = resolveEntitlements({
    subscription: null,
    now: NOW,
    enforcementEnabled: false,
  });
  assert.deepEqual(sorted(withoutRow), sorted(ALL_ENTITLEMENTS));
});

test('a missing subscription row grants nothing, not even reads', () => {
  // "No row" must never read as "allowed". The migration backfills every organization so this
  // is unreachable in practice, and it fails closed if it ever happens.
  assert.deepEqual(resolve(null), []);
});

test('complimentary access grants everything in every status', () => {
  for (const status of SUBSCRIPTION_STATUSES) {
    const granted = resolve({ status, isExempt: true });
    assert.deepEqual(sorted(granted), sorted(ALL_ENTITLEMENTS));
  }
});

test('an active subscription grants everything', () => {
  assert.deepEqual(sorted(resolve({ status: 'ACTIVE' })), sorted(ALL_ENTITLEMENTS));
});

test('a pending organization keeps full access until its transition window closes', () => {
  const inWindow = resolve({ status: 'PENDING', restrictAfter: TOMORROW });
  assert.deepEqual(sorted(inWindow), sorted(ALL_ENTITLEMENTS));

  const expired = resolve({ status: 'PENDING', restrictAfter: YESTERDAY });
  assert.deepEqual(sorted(expired), sorted(READ_ENTITLEMENTS));
});

test('a pending organization with no transition window is restricted immediately', () => {
  // Organizations created after rollout get no grandfathering.
  assert.deepEqual(sorted(resolve({ status: 'PENDING' })), sorted(READ_ENTITLEMENTS));
});

test('a failed payment keeps full access until the grace period ends', () => {
  const inGrace = resolve({ status: 'PAST_DUE', graceEndsAt: TOMORROW });
  assert.deepEqual(sorted(inGrace), sorted(ALL_ENTITLEMENTS));

  const expired = resolve({ status: 'PAST_DUE', graceEndsAt: YESTERDAY });
  assert.deepEqual(sorted(expired), sorted(READ_ENTITLEMENTS));
});

test('a past due subscription with no grace deadline is restricted', () => {
  assert.deepEqual(sorted(resolve({ status: 'PAST_DUE' })), sorted(READ_ENTITLEMENTS));
});

test('restricted and canceled subscriptions keep reads and lose writes', () => {
  for (const status of ['RESTRICTED', 'CANCELED']) {
    assert.deepEqual(sorted(resolve({ status })), sorted(READ_ENTITLEMENTS));
  }
});

test('the two timers are independent', () => {
  // A pending organization inside its transition window is not rescued by an expired grace
  // deadline, and a past due one is not rescued by a transition window it no longer owns.
  const pending = resolve({
    status: 'PENDING',
    restrictAfter: TOMORROW,
    graceEndsAt: YESTERDAY,
  });
  assert.deepEqual(sorted(pending), sorted(ALL_ENTITLEMENTS));

  const pastDue = resolve({
    status: 'PAST_DUE',
    restrictAfter: TOMORROW,
    graceEndsAt: YESTERDAY,
  });
  assert.deepEqual(sorted(pastDue), sorted(READ_ENTITLEMENTS));
});

test('a deadline exactly now has already passed', () => {
  assert.deepEqual(
    sorted(resolve({ status: 'PENDING', restrictAfter: NOW })),
    sorted(READ_ENTITLEMENTS),
  );
  assert.deepEqual(
    sorted(resolve({ status: 'PAST_DUE', graceEndsAt: NOW })),
    sorted(READ_ENTITLEMENTS),
  );
});

test('read entitlements never contain a write entitlement', () => {
  for (const entitlement of WRITE_ENTITLEMENTS) {
    assert.equal(hasEntitlement(READ_ENTITLEMENTS, entitlement), false, entitlement);
  }
});

test('every entitlement is either a read or a write, and reads cover every feature', () => {
  assert.equal(READ_ENTITLEMENTS.length + WRITE_ENTITLEMENTS.length, ALL_ENTITLEMENTS.length);

  for (const entitlement of ALL_ENTITLEMENTS) {
    const isRead = READ_ENTITLEMENTS.includes(entitlement);
    const isWrite = WRITE_ENTITLEMENTS.includes(entitlement);
    assert.ok(isRead !== isWrite, `${entitlement} must be exactly one of read or write`);
  }
});

test('every declared status has a rule', () => {
  // Guards against a status being added to the union without deciding what it grants.
  for (const status of SUBSCRIPTION_STATUSES) {
    const granted = resolve({ status });
    assert.ok(Array.isArray(granted), status);
  }
});

test('resolution never hands back a mutable shared array', () => {
  const granted = resolve({ status: 'RESTRICTED' });
  assert.throws(() => granted.push(ENTITLEMENTS.membersWrite));
  assert.deepEqual(sorted(resolve({ status: 'RESTRICTED' })), sorted(READ_ENTITLEMENTS));
});
