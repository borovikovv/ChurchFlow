const assert = require('node:assert/strict');
const test = require('node:test');
const {
  cancellationTransition,
  transitionForCallbackStatus,
} = require('../dist/modules/billing/subscription-transitions');
const {
  SubscriptionsRepository,
} = require('../dist/modules/billing/repositories/subscriptions.repository');
const { BillingService } = require('../dist/modules/billing/billing.service');
const { resolveEntitlements, ALL_ENTITLEMENTS, READ_ENTITLEMENTS } = require('@churchflow/shared');
const NOW = new Date('2026-09-08T12:00:00Z');
const PAID_UNTIL = new Date('2026-09-20T12:00:00Z');
const ACCESS_UNTIL = new Date('2026-09-27T12:00:00Z');
const ACTIVE = {
  status: 'ACTIVE',
  currentPeriodEndsAt: PAID_UNTIL,
  graceEndsAt: null,
  cancelRequestedAt: null,
};

function access(subscription, now, overrides = {}) {
  return resolveEntitlements({
    subscription: { ...subscription, isExempt: false, restrictAfter: null, ...overrides },
    now,
    enforcementEnabled: true,
  });
}

test('canceling retains paid access followed by exactly seven days of grace without waiting for cron', () => {
  const canceled = cancellationTransition(ACTIVE, NOW);
  assert.equal(canceled.status, 'ACTIVE');
  assert.deepEqual(canceled.graceEndsAt, ACCESS_UNTIL);
  assert.deepEqual(canceled.currentPeriodEndsAt, PAID_UNTIL);
  for (const now of [NOW, PAID_UNTIL, new Date(ACCESS_UNTIL.getTime() - 1)]) {
    assert.deepEqual(access(canceled, now), ALL_ENTITLEMENTS);
  }
  assert.deepEqual(access(canceled, ACCESS_UNTIL), READ_ENTITLEMENTS);
});

test('repeated cancellation and provider notifications never move the deadline', () => {
  const canceled = cancellationTransition(ACTIVE, NOW);
  assert.deepEqual(cancellationTransition(canceled, PAID_UNTIL), canceled);
  for (const callbackStatus of ['unsubscribed', 'failure']) {
    assert.equal(
      transitionForCallbackStatus({
        current: canceled,
        callbackStatus,
        now: PAID_UNTIL,
        isNewSubscription: false,
      }),
      null,
    );
  }
});

test('a new checkout clears cancellation intent and restores a monthly subscription', () => {
  const next = transitionForCallbackStatus({
    current: cancellationTransition(ACTIVE, NOW),
    callbackStatus: 'success',
    now: ACCESS_UNTIL,
    isNewSubscription: true,
  });
  assert.equal(next.status, 'ACTIVE');
  assert.equal(next.cancelRequestedAt, null);
  assert.equal(next.graceEndsAt, null);
  assert.deepEqual(next.currentPeriodEndsAt, new Date('2026-10-27T12:00:00Z'));
});

test('canceling while past due preserves the existing grace deadline', () => {
  const graceEndsAt = new Date('2026-09-10T12:00:00Z');
  const canceled = cancellationTransition({ ...ACTIVE, status: 'PAST_DUE', graceEndsAt }, NOW);
  assert.equal(canceled.status, 'PAST_DUE');
  assert.equal(canceled.graceEndsAt, graceEndsAt);

  // The same row cancelled after that deadline has already passed. A spent deadline grants
  // nothing, and keeping it is what told the organization its access "continues until" yesterday.
  const expired = cancellationTransition(
    { ...ACTIVE, status: 'PAST_DUE', graceEndsAt },
    PAID_UNTIL,
  );
  assert.equal(expired.status, 'CANCELED');
  assert.equal(expired.graceEndsAt, null);
});

test('a subscription cancelled before cancellation was recorded is left as it is', () => {
  // Legacy rows carry no cancellation timestamp, and the nightly unsubscribe retry still draws an
  // `unsubscribed` out of LiqPay for them. Acting on it would restate an old cancellation as new.
  assert.equal(
    transitionForCallbackStatus({
      current: { ...ACTIVE, status: 'CANCELED', currentPeriodEndsAt: PAID_UNTIL },
      callbackStatus: 'unsubscribed',
      now: NOW,
      isNewSubscription: false,
    }),
    null,
  );
});

test('a payment reversed after cancellation shortens access instead of leaving it paid for', () => {
  // Everything else a cancelled subscription reports is noise, but a chargeback takes back the
  // money the remaining access was granted for.
  const canceled = cancellationTransition(ACTIVE, NOW);
  const reversed = transitionForCallbackStatus({
    current: canceled,
    callbackStatus: 'reversed',
    now: NOW,
    isNewSubscription: false,
  });

  assert.deepEqual(reversed.graceEndsAt, new Date('2026-09-15T12:00:00Z'));
  assert.deepEqual(reversed.cancelRequestedAt, canceled.cancelRequestedAt);
  assert.equal(reversed.status, 'ACTIVE');
  assert.deepEqual(access(reversed, new Date('2026-09-16T12:00:00Z')), READ_ENTITLEMENTS);

  // A deadline already sooner than the grace period is left alone, so a second reversal neither
  // extends access nor repeats the notice.
  assert.equal(
    transitionForCallbackStatus({
      current: reversed,
      callbackStatus: 'reversed',
      now: NOW,
      isNewSubscription: false,
    }),
    null,
  );
});

test('unpaid, restricted and legacy canceled subscriptions gain no access by canceling', () => {
  for (const status of ['PENDING', 'RESTRICTED', 'CANCELED']) {
    const canceled = cancellationTransition({ ...ACTIVE, status }, NOW);
    assert.equal(canceled.status, 'CANCELED');
    assert.equal(canceled.graceEndsAt, null);
    assert.deepEqual(access(canceled, NOW), READ_ENTITLEMENTS);
  }
  assert.deepEqual(access({ ...ACTIVE, status: 'CANCELED' }, NOW), READ_ENTITLEMENTS);
});

test('complimentary access and disabled enforcement override the cancellation deadline', () => {
  const canceled = cancellationTransition(ACTIVE, NOW);
  assert.deepEqual(access(canceled, ACCESS_UNTIL, { isExempt: true }), ALL_ENTITLEMENTS);
  assert.deepEqual(
    resolveEntitlements({
      subscription: { ...canceled, isExempt: false, restrictAfter: null },
      now: ACCESS_UNTIL,
      enforcementEnabled: false,
    }),
    ALL_ENTITLEMENTS,
  );
});

test('a provider unsubscribe uses the same paid access deadline as a manual cancellation', () => {
  assert.deepEqual(
    transitionForCallbackStatus({
      current: ACTIVE,
      callbackStatus: 'unsubscribed',
      now: NOW,
      isNewSubscription: false,
    }),
    cancellationTransition(ACTIVE, NOW),
  );
});

test('cancellation is durable before the provider call and repeat requests do not rewrite it', async () => {
  const events = [];
  let row = {
    ...ACTIVE,
    liqpayOrderId: 'order',
    organization: { id: 'org', name: 'Test' },
    unsubscribeRequests: [],
  };
  const service = new BillingService(
    {
      findByOrganizationId: async () => row,
      cancel: async (input) => {
        assert.equal(input.expectedUpdatedAt, row.updatedAt);
        assert.equal(input.unsubscribeOrderId, 'order');
        // The deadline is decided by the service, so the repository writes it rather than
        // recomputing it from a row it read again inside its own transaction.
        assert.equal(input.data.status, 'ACTIVE');
        assert.deepEqual(input.data.currentPeriodEndsAt, PAID_UNTIL);
        assert.ok(input.data.cancelRequestedAt instanceof Date);
        events.push('persist');
        row = { ...row, ...cancellationTransition(row, NOW) };
        return row;
      },
      listAdminMembershipIds: async () => [],
      resolveUnsubscribeRequest: async () => events.push('resolved'),
    },
    { listForOrganization: async () => [] },
    {
      unsubscribe: async () => {
        events.push('provider');
        return 'stopped';
      },
    },
    {},
    {},
  );
  await service.cancel('org', 'actor');
  await service.cancel('org', 'actor');
  assert.deepEqual(events, ['persist', 'provider', 'resolved']);
});

test('a provider that will not answer does not fail a cancellation already saved', async () => {
  // The row is written and the notice is sent before LiqPay is called at all. Reporting an error
  // afterwards would tell the organization its cancellation failed when it had not.
  let row = {
    ...ACTIVE,
    id: 'subscription',
    organizationId: 'org',
    isExempt: false,
    restrictAfter: null,
    liqpayOrderId: 'order',
    organization: { id: 'org', name: 'Test' },
    unsubscribeRequests: [],
  };
  const service = new BillingService(
    {
      findByOrganizationId: async () => row,
      cancel: async () => {
        row = { ...row, ...cancellationTransition(row, NOW) };
        return row;
      },
      listAdminMembershipIds: async () => [],
      resolveUnsubscribeRequest: async () => ({ count: 1 }),
    },
    { listForOrganization: async () => [] },
    {
      unsubscribe: async () => {
        throw new Error('Billing is not configured');
      },
    },
    {},
    {},
  );
  service.logger = { warn: () => {}, error: () => {}, log: () => {} };

  const summary = await service.cancel('org', 'actor');
  assert.equal(summary.status, 'ACTIVE');
  assert.equal(summary.cancelRequestedAt, NOW.toISOString());
  assert.equal(summary.graceEndsAt, ACCESS_UNTIL.toISOString());
});

test('scheduled cancellation finalizes as CANCELED and preserves its deadline', async () => {
  const writes = [];
  const repository = new SubscriptionsRepository({
    subscription: {
      updateMany: async (query) => {
        writes.push(query);
        return { count: 1 };
      },
    },
  });
  assert.deepEqual(await repository.restrictIfStillDue('subscription', ACCESS_UNTIL), { count: 1 });
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].data, { status: 'CANCELED' });
  assert.deepEqual(writes[0].where.graceEndsAt, { lte: ACCESS_UNTIL });
  assert.deepEqual(writes[0].where.cancelRequestedAt, { not: null });
});

test('renewal reconciliation excludes intentionally canceled auto-renewals on reads and writes', async () => {
  const queries = [];
  const repository = new SubscriptionsRepository({
    subscription: {
      findMany: async (query) => {
        queries.push(query);
        return [];
      },
      updateMany: async (query) => {
        queries.push(query);
        return { count: 0 };
      },
    },
  });
  await repository.listUnconfirmedRenewals(NOW);
  await repository.markPastDueIfStillUnconfirmed({
    subscriptionId: 'subscription',
    cutoff: NOW,
    graceEndsAt: ACCESS_UNTIL,
  });
  assert.equal(queries.length, 2);
  for (const query of queries) assert.equal(query.where.cancelRequestedAt, null);
});

test('a concurrent subscription change refuses cancellation before contacting the provider', async () => {
  const { Prisma } = require('@churchflow/db');
  let called = false;
  const service = new BillingService(
    {
      findByOrganizationId: async () => ({ ...ACTIVE, liqpayOrderId: 'old-order' }),
      cancel: async () => {
        throw new Prisma.PrismaClientKnownRequestError('Record changed', {
          code: 'P2025',
          clientVersion: 'test',
        });
      },
    },
    {},
    {
      unsubscribe: async () => {
        called = true;
      },
    },
    {},
    {},
  );
  await assert.rejects(
    () => service.cancel('org', 'actor'),
    (error) => error.getStatus() === 409,
  );
  assert.equal(called, false);
});

test('provider cancellation closes previously offered checkouts in the same transaction', async () => {
  const closed = [];
  const repository = new SubscriptionsRepository({
    $transaction: async (run) =>
      run({
        billingUnsubscribeRequest: { updateMany: async () => ({ count: 1 }) },
        billingCallback: { create: async () => ({}) },
        subscription: { updateMany: async () => ({ count: 1 }) },
        billingCheckoutOrder: {
          updateMany: async (query) => {
            closed.push(query);
            return { count: 1 };
          },
        },
        auditLog: { create: async () => ({}) },
      }),
  });
  await repository.applyCallback({
    subscriptionId: 'subscription',
    organizationId: 'org',
    orderId: 'order',
    paymentId: 'unsubscribe',
    status: 'unsubscribed',
    previousStatus: 'ACTIVE',
    nextStatus: 'ACTIVE',
    expectedLiqpayOrderId: 'order',
    expectedCancelRequestedAt: null,
    payload: {},
    update: cancellationTransition(ACTIVE, NOW),
    checkout: null,
    unsubscribeOrderId: null,
    abandonOpenCheckouts: true,
  });
  assert.equal(closed.length, 1);
  assert.deepEqual(closed[0].where, { subscriptionId: 'subscription', status: 'PROPOSED' });
  assert.equal(closed[0].data.status, 'ABANDONED');
});

test('cancel on a pending organization preserves its rollout access and calls no provider', async () => {
  const row = {
    ...ACTIVE,
    status: 'PENDING',
    currentPeriodEndsAt: null,
    liqpayOrderId: null,
    restrictAfter: ACCESS_UNTIL,
    unsubscribeRequests: [],
  };
  let writes = 0;
  let providerCalls = 0;
  const service = new BillingService(
    {
      findByOrganizationId: async () => row,
      cancel: async () => {
        writes++;
      },
    },
    { listForOrganization: async () => access(row, NOW, { restrictAfter: ACCESS_UNTIL }) },
    {
      unsubscribe: async () => {
        providerCalls++;
      },
    },
    {},
    {},
  );
  const summary = await service.cancel('org', 'actor');
  assert.equal(summary.status, 'PENDING');
  assert.equal(summary.restrictAfter, ACCESS_UNTIL.toISOString());
  assert.equal(summary.canCancel, false);
  assert.deepEqual(summary.entitlements, ALL_ENTITLEMENTS);
  assert.equal(writes, 0);
  assert.equal(providerCalls, 0);
});

test('current cancellation pending is distinguished from unresolved older orders', async () => {
  const row = {
    ...ACTIVE,
    cancelRequestedAt: NOW,
    liqpayOrderId: 'current',
    unsubscribeRequests: [{ orderId: 'previous' }],
  };
  const service = new BillingService(
    { findByOrganizationId: async () => row },
    { listForOrganization: async () => [] },
    {},
    {},
    {},
  );
  const summary = await service.getSummary('org');
  assert.equal(summary.cancellationPending, false);
  assert.equal(summary.previousCancellationPending, true);
  row.unsubscribeRequests.push({ orderId: 'current' });
  assert.equal((await service.getSummary('org')).cancellationPending, true);
});

test('unsubscribe callback resolves only its own queued request even with no state transition', async () => {
  const resolved = [];
  const repository = new SubscriptionsRepository({
    $transaction: async (run) =>
      run({
        billingCallback: { create: async () => ({}) },
        billingUnsubscribeRequest: {
          updateMany: async (query) => {
            resolved.push(query);
            return { count: 1 };
          },
        },
      }),
  });
  await repository.applyCallback({
    subscriptionId: 'sub',
    organizationId: 'org',
    orderId: 'old',
    paymentId: 'unsubscribe',
    status: 'unsubscribed',
    update: null,
    checkout: null,
    unsubscribeOrderId: null,
    credited: false,
    issue: null,
  });
  assert.deepEqual(resolved[0].where, { orderId: 'old', resolvedAt: null });
  assert.ok(resolved[0].data.resolvedAt instanceof Date);
});
