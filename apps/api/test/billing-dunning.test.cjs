const assert = require('node:assert/strict');
const test = require('node:test');
const {
  SubscriptionsRepository,
} = require('../dist/modules/billing/repositories/subscriptions.repository');
const { BillingDunningScheduler } = require('../dist/modules/billing/billing-dunning.scheduler');
const { BillingService } = require('../dist/modules/billing/billing.service');
const { LiqPayService } = require('../dist/modules/billing/liqpay.service');

const NOW = new Date('2026-09-01T12:00:00.000Z');

function capturingRepository() {
  const queries = [];
  const repository = new SubscriptionsRepository({
    subscription: {
      findMany: async (args) => {
        queries.push(args);
        return [];
      },
      updateMany: async (args) => {
        queries.push(args);
        return { count: 0 };
      },
      update: async () => ({}),
    },
  });

  return { repository, queries };
}

test('every scheduled query skips organizations with complimentary access', async () => {
  // Without this filter the job would charge test and partner churches into RESTRICTED.
  const { repository, queries } = capturingRepository();

  await repository.listRestrictionDue(NOW);
  await repository.listTransitionWindowOpen(NOW);
  await repository.listUnconfirmedRenewals(NOW);

  assert.equal(queries.length, 3);
  for (const query of queries) {
    assert.equal(query.where.isExempt, false);
  }
});

test('restriction is due on an expired rollout window or an expired grace period', async () => {
  const { repository, queries } = capturingRepository();

  await repository.listRestrictionDue(NOW);

  assert.deepEqual(queries[0].where.OR, [
    { status: 'PENDING', restrictAfter: { lte: NOW } },
    { status: 'PAST_DUE', graceEndsAt: { lte: NOW } },
    { cancelRequestedAt: { not: null }, status: { not: 'CANCELED' }, graceEndsAt: { lte: NOW } },
  ]);
  // A PENDING row with no window is a post-rollout organization: already read-only by
  // resolution, so flipping its status would only produce a misleading notice.
  assert.equal(queries[0].where.OR[0].restrictAfter.lte, NOW);
});

test('deleted and suspended organizations are left out of dunning', async () => {
  const { repository, queries } = capturingRepository();

  await repository.listRestrictionDue(NOW);

  assert.deepEqual(queries[0].where.organization, { status: 'ACTIVE', deletedAt: null });
});

function scheduler({
  due = [],
  open = [],
  unconfirmed = [],
  pendingStops = [],
  reopenedCount = 0,
  enforcementEnabled = true,
  // How many rows the guarded writes actually change. Zero is the row that stopped being due
  // between the batch being read and this write reaching it.
  restrictedCount = 1,
  pastDueCount = 1,
  // Orders LiqPay confirms as paid when the job asks about a renewal it never heard about.
  confirmedOrders = [],
} = {}) {
  const restricted = [];
  const pastDue = [];
  const notified = [];
  const stopped = [];
  const reopened = [];
  const asked = [];

  const repository = {
    listRestrictionDue: async () => due,
    listTransitionWindowOpen: async () => open,
    listUnconfirmedRenewals: async () => unconfirmed,
    listOpenUnsubscribeRequests: async () => pendingStops,
    reopenStaleTransitionWindows: async (input) => {
      reopened.push(input);
      return { count: reopenedCount };
    },
    markPastDueIfStillUnconfirmed: async ({ subscriptionId, cutoff, graceEndsAt }) => {
      pastDue.push({ id: subscriptionId, cutoff, graceEndsAt });
      return { count: pastDueCount };
    },
    restrictIfStillDue: async (id, now) => {
      restricted.push(id);
      return { count: restrictedCount, now };
    },
  };

  const billingService = {
    notifyOrganizationAdmins: async (input) => {
      notified.push(input);
    },
    stopOrder: async (orderId) => {
      stopped.push({ orderId });
      return orderId !== 'stubborn-order';
    },
    reconcileOrderWithProvider: async (orderId) => {
      asked.push(orderId);
      return confirmedOrders.includes(orderId);
    },
  };

  const lock = {
    runOnce: async (name, job) => ({ skipped: false, result: await job() }),
  };

  return {
    instance: new BillingDunningScheduler(repository, billingService, lock, {
      isEnforcementEnabled: () => enforcementEnabled,
    }),
    restricted,
    pastDue,
    notified,
    stopped,
    reopened,
    asked,
  };
}

const DUE_ROW = {
  id: 'subscription',
  organizationId: 'organization',
  status: 'PAST_DUE',
  organization: { members: [{ id: 'membership-1' }, { id: 'membership-2' }] },
};

test('an expired subscription is restricted and its owners are told', async () => {
  const { instance, restricted, notified } = scheduler({ due: [DUE_ROW] });

  const result = await instance.run(NOW);

  assert.equal(result.restrictedCount, 1);
  assert.deepEqual(restricted, ['subscription']);
  assert.equal(notified[0].type, 'SUBSCRIPTION_RESTRICTED');
  assert.deepEqual(notified[0].recipientMembershipIds, ['membership-1', 'membership-2']);
});

test('an open rollout window warns once, and again on its last day', async () => {
  const farOff = {
    id: 'a',
    organizationId: 'org-a',
    restrictAfter: new Date('2026-09-06T12:00:00.000Z'),
    organization: { members: [{ id: 'm-a' }] },
  };
  const lastDay = {
    id: 'b',
    organizationId: 'org-b',
    restrictAfter: new Date('2026-09-02T06:00:00.000Z'),
    organization: { members: [{ id: 'm-b' }] },
  };

  const { instance, notified } = scheduler({ open: [farOff, lastDay] });

  const result = await instance.run(NOW);

  assert.equal(result.warnedCount, 2);
  assert.equal(notified[0].dedupeKey, 'transition-window');
  assert.equal(notified[1].dedupeKey, 'transition-window-final');
  // Distinct keys are what let the same job send both without repeating either on a rerun.
  assert.notEqual(notified[0].dedupeKey, notified[1].dedupeKey);
  assert.equal(notified[1].bodyMessage.deadline, '2026-09-02T06:00:00.000Z');
});

test('a held lock means the job does no work at all', async () => {
  const repository = {
    listRestrictionDue: async () => {
      throw new Error('should not run while another instance holds the lock');
    },
    listTransitionWindowOpen: async () => [],
    listUnconfirmedRenewals: async () => [],
    listOpenUnsubscribeRequests: async () => [],
    reopenStaleTransitionWindows: async () => ({ count: 0 }),
    restrict: async () => ({}),
  };

  const instance = new BillingDunningScheduler(
    repository,
    { notifyOrganizationAdmins: async () => undefined },
    { runOnce: async () => ({ skipped: true }) },
    { isEnforcementEnabled: () => true },
  );

  await instance.handleDunning();
});

test('a paid period that ended with no callback is not left running for free', async () => {
  // Nothing else in the system notices an undelivered callback, so without this the
  // organization keeps full access forever.
  const { instance, pastDue, notified } = scheduler({
    unconfirmed: [
      {
        id: 'subscription',
        organizationId: 'organization',
        organization: { members: [{ id: 'membership' }] },
      },
    ],
  });

  const result = await instance.run(NOW);

  assert.equal(result.reconciledCount, 1);
  // PAST_DUE, not RESTRICTED: the payment is unconfirmed rather than known to have failed, so
  // the organization still gets its full grace period.
  assert.equal(pastDue[0].id, 'subscription');
  assert.equal(pastDue[0].graceEndsAt.toISOString(), '2026-09-08T12:00:00.000Z');
  assert.equal(notified[0].type, 'SUBSCRIPTION_PAYMENT_FAILED');
});

test('reconciliation allows for a late settlement before acting', async () => {
  const { repository, queries } = capturingRepository();

  await repository.listUnconfirmedRenewals(NOW);

  assert.equal(queries[0].where.status, 'ACTIVE');
  assert.equal(queries[0].where.isExempt, false);
  assert.ok(queries[0].where.currentPeriodEndsAt.lte instanceof Date);
});

test('a cancellation LiqPay has not accepted is retried until it does', async () => {
  const { instance, stopped } = scheduler({
    pendingStops: [
      { id: 'a', organizationId: 'org-a', subscriptionId: 'sub-a', orderId: 'order-a' },
      { id: 'b', organizationId: 'org-b', subscriptionId: 'sub-b', orderId: 'stubborn-order' },
    ],
  });

  const result = await instance.run(NOW);

  assert.deepEqual(
    stopped.map((entry) => entry.orderId),
    ['order-a', 'stubborn-order'],
  );
  // Only the one LiqPay accepted is counted as stopped; the other stays queued for next time.
  assert.equal(result.stoppedCount, 1);
});

test('nothing is restricted or warned while the kill switch is off', async () => {
  // The rollout migration starts every window at deploy time, before anyone has enabled
  // enforcement. Running the job anyway would restrict every church that existed at migration
  // time and tell them their access had ended, while nothing was actually being enforced.
  const { instance, restricted, notified, reopened } = scheduler({
    due: [DUE_ROW],
    open: [
      {
        id: 'a',
        organizationId: 'org-a',
        restrictAfter: new Date('2026-09-06T12:00:00.000Z'),
        organization: { members: [{ id: 'm-a' }] },
      },
    ],
    unconfirmed: [{ id: 'b', organizationId: 'org-b', organization: { members: [{ id: 'm-b' }] } }],
    enforcementEnabled: false,
  });

  const result = await instance.run(NOW);

  assert.deepEqual(restricted, []);
  assert.deepEqual(notified, []);
  assert.deepEqual(reopened, []);
  assert.equal(result.restrictedCount, 0);
  assert.equal(result.reconciledCount, 0);
  assert.equal(result.warnedCount, 0);
});

test('an order LiqPay is still charging is stopped even with the kill switch off', async () => {
  // Restriction is a policy we can suspend; a card being charged for a subscription nobody has
  // is not, so the retries keep running whatever the switch says.
  const { instance, stopped } = scheduler({
    pendingStops: [{ id: 'a', organizationId: 'org-a', orderId: 'order-a' }],
    enforcementEnabled: false,
  });

  const result = await instance.run(NOW);

  assert.deepEqual(
    stopped.map((entry) => entry.orderId),
    ['order-a'],
  );
  assert.equal(result.stoppedCount, 1);
});

test('a rollout window that ran out unenforced is handed back, not spent', async () => {
  const { instance, reopened } = scheduler({ reopenedCount: 3 });

  const result = await instance.run(NOW);

  assert.equal(result.reopenedCount, 3);
  // Anything staler than a couple of days had no nightly job watching it, so its churches were
  // never warned; they get the full window again rather than losing write access unannounced.
  assert.equal(reopened[0].staleBefore.toISOString(), '2026-08-30T12:00:00.000Z');
  assert.equal(reopened[0].restrictAfter.toISOString(), '2026-09-08T12:00:00.000Z');
});

test('reopening a stale window only reaches unenforced rollout windows', async () => {
  const { repository, queries } = capturingRepository();

  await repository.reopenStaleTransitionWindows({
    staleBefore: new Date('2026-08-30T12:00:00.000Z'),
    restrictAfter: new Date('2026-09-08T12:00:00.000Z'),
  });

  assert.equal(queries[0].where.status, 'PENDING');
  assert.equal(queries[0].where.isExempt, false);
  assert.deepEqual(queries[0].where.organization, { status: 'ACTIVE', deletedAt: null });
  assert.equal(queries[0].where.restrictAfter.lte.toISOString(), '2026-08-30T12:00:00.000Z');
  // A grace period is a different timer and is never touched here.
  assert.equal('graceEndsAt' in queries[0].where, false);
});

function checkoutService({
  subscription,
  unsubscribeOk = true,
  unsubscribeOutcome = null,
  onCancel = () => {},
}) {
  const started = [];
  const unsubscribed = [];
  const resolved = [];

  const liqPayService = new LiqPayService({
    get: (key) =>
      ({
        LIQPAY_PUBLIC_KEY: 'public',
        LIQPAY_PRIVATE_KEY: 'private',
        LIQPAY_CALLBACK_URL: 'https://example.test/callback',
        LIQPAY_RESULT_URL: 'https://example.test/result',
      })[key],
  });
  liqPayService.unsubscribe = async (orderId) => {
    unsubscribed.push(orderId);
    return unsubscribeOutcome ?? (unsubscribeOk ? 'stopped' : 'retry');
  };

  const service = new BillingService(
    {
      listAdminMembershipIds: async () => [],
      findByOrganizationId: async () => subscription,
      findReusableCheckout: async () => null,
      createCheckoutOrder: async (input) => {
        started.push(input);
        return { id: 'checkout', ...input };
      },
      resolveUnsubscribeRequest: async (orderId) => {
        resolved.push(orderId);
        return { count: 1 };
      },
      cancel: async (input) => {
        onCancel(input);
        return {};
      },
    },
    { listForOrganization: async () => [] },
    liqPayService,
    { getCurrent: async () => ({ usdToUah: 41.5, eurToUah: 48.2 }) },
    { createSubscriptionNotifications: async () => ({ createdCount: 0 }) },
  );

  return { service, started, unsubscribed, resolved };
}

const PENDING_SUBSCRIPTION = {
  cancelRequestedAt: null,
  unsubscribeRequests: [],
  id: 'subscription',
  organizationId: 'organization',
  status: 'PENDING',
  isExempt: false,
  liqpayOrderId: null,
  organization: { id: 'organization', name: 'Grace Church' },
};

test('the hryvnia amount is pinned at subscribe time from the published rate', async () => {
  const { service, started } = checkoutService({ subscription: PENDING_SUBSCRIPTION });

  const checkout = await service.startCheckout('organization', 'actor');

  // 4.5 USD at 41.5 UAH/USD = 186.75 UAH = 18675 kopiykas, fixed for the subscription's life.
  assert.equal(started[0].amountMinor, 18_675);
  assert.equal(started[0].actorUserId, 'actor');
  assert.ok(started[0].fxRateUsedAt instanceof Date);

  // The whole price is pinned on the order, not just the amount: the order that gets paid is the
  // one whose price becomes live, and that is not always the one offered last.
  assert.equal(started[0].currency, 'UAH');
  assert.equal(started[0].usdReference, 4.5);

  const payload = JSON.parse(Buffer.from(checkout.data, 'base64').toString('utf8'));
  assert.equal(payload.amount, 186.75);
  assert.equal(payload.currency, 'UAH');
});

test('offering a replacement card leaves the running subscription charging', async () => {
  // The payer may close the LiqPay tab. Cancelling the live order first would leave the church
  // with no subscription, nothing charging it, and no code path that ever notices.
  const { service, started, unsubscribed } = checkoutService({
    subscription: { ...PENDING_SUBSCRIPTION, status: 'ACTIVE', liqpayOrderId: 'old-order' },
  });

  await service.startCheckout('organization', 'actor');

  assert.deepEqual(unsubscribed, []);
  assert.notEqual(started[0].orderId, 'old-order');
  // The offered price is held on its own order; the live one is only replaced once a payment
  // succeeds, so nothing here touches the subscription that is still charging.
  assert.equal(started[0].subscriptionId, 'subscription');
  assert.equal(started[0].amountMinor, 18_675);
});

test('an unsubscribe LiqPay would not accept stays queued for the dunning job', async () => {
  const canceled = [];
  const { service, resolved } = checkoutService({
    subscription: { ...PENDING_SUBSCRIPTION, status: 'ACTIVE', liqpayOrderId: 'old-order' },
    unsubscribeOk: false,
    onCancel: (input) => canceled.push(input),
  });

  await service.cancel('organization', 'actor');

  // Queued whatever LiqPay answers, because the alternative is a card that keeps being charged
  // behind a subscription we show as cancelled. `retry` leaves it open for the nightly retry.
  assert.deepEqual(
    canceled.map((input) => input.unsubscribeOrderId),
    ['old-order'],
  );
  assert.deepEqual(resolved, []);
});

test('an unsubscribe LiqPay accepted closes the request it was queued under', async () => {
  const canceled = [];
  const { service, resolved } = checkoutService({
    subscription: { ...PENDING_SUBSCRIPTION, status: 'ACTIVE', liqpayOrderId: 'old-order' },
    onCancel: (input) => canceled.push(input),
  });

  await service.cancel('organization', 'actor');

  // Which order was closed is the whole point: an unsubscribe queued earlier for a different
  // order is still charging a card and must survive this cancellation.
  assert.deepEqual(
    canceled.map((input) => input.unsubscribeOrderId),
    ['old-order'],
  );
  assert.deepEqual(resolved, ['old-order']);
});

test('an organization with complimentary access is not sent to checkout', async () => {
  const { service, started } = checkoutService({
    subscription: { ...PENDING_SUBSCRIPTION, isExempt: true },
  });

  await assert.rejects(() => service.startCheckout('organization', 'actor'), /complimentary/i);
  assert.equal(started.length, 0);
});

test('checkout refuses rather than guessing a price when no rate is published', async () => {
  const { service } = checkoutService({ subscription: PENDING_SUBSCRIPTION });
  service.currencyRatesService = { getCurrent: async () => null };

  await assert.rejects(() => service.startCheckout('organization', 'actor'), /exchange rate/i);
});

function cancelRepository() {
  const queued = [];
  const resolved = [];

  const tx = {
    subscription: {
      findUniqueOrThrow: async () => ({
        status: 'PENDING',
        currentPeriodEndsAt: null,
        graceEndsAt: null,
      }),
      update: async ({ data }) => {
        assert.equal(data.status, 'CANCELED');

        return { id: 'subscription' };
      },
    },
    billingUnsubscribeRequest: {
      upsert: async ({ create }) => {
        queued.push(create.orderId);

        return create;
      },
      updateMany: async ({ where }) => {
        resolved.push(where);

        return { count: 1 };
      },
    },
    billingCheckoutOrder: { updateMany: async () => ({ count: 0 }) },
    auditLog: { create: async () => ({}) },
  };

  const repository = new SubscriptionsRepository({
    $transaction: async (run) => run(tx),
  });

  return { repository, queued, resolved };
}

test('cancelling queues the live order before LiqPay is asked anything', async () => {
  // Queued inside the transaction that records the cancellation. An order queued nowhere is an
  // order that keeps charging a card with nothing left in the system aware of it.
  const { repository, queued, resolved } = cancelRepository();

  await repository.cancel({
    organizationId: 'organization',
    actorUserId: 'actor',
    expectedUpdatedAt: NOW,
    data: { status: 'CANCELED' },
    unsubscribeOrderId: 'old-order',
  });

  assert.deepEqual(queued, ['old-order']);
  assert.deepEqual(resolved, []);
});

test('the nightly writes repeat the predicate the row was selected by', async () => {
  const { repository, queries } = capturingRepository();

  await repository.restrictIfStillDue('subscription', NOW);
  await repository.markPastDueIfStillUnconfirmed({
    subscriptionId: 'subscription',
    cutoff: NOW,
    graceEndsAt: NOW,
  });

  assert.equal(queries[0].data.status, 'CANCELED');
  assert.deepEqual(queries[1].where.OR, [
    { status: 'PENDING', restrictAfter: { lte: NOW } },
    { status: 'PAST_DUE', graceEndsAt: { lte: NOW } },
  ]);
  assert.equal(queries[1].where.id, 'subscription');
  assert.equal(queries[2].where.status, 'ACTIVE');
  assert.equal(queries[2].where.currentPeriodEndsAt.lte, NOW);
  for (const query of queries) {
    assert.equal(query.where.isExempt, false);
  }
});

test('an organization that paid while the pass ran is not restricted by it', async () => {
  // The batch is read once and written row by row. A callback landing in between used to be
  // overwritten by a decision taken before it, taking write access from a church that had paid.
  const { instance, notified } = scheduler({ due: [DUE_ROW], restrictedCount: 0 });

  const result = await instance.run(NOW);

  assert.equal(result.restrictedCount, 0);
  assert.deepEqual(notified, []);
});

test('a renewal that arrived mid-pass is not reconciled into PAST_DUE', async () => {
  const { instance, notified } = scheduler({
    unconfirmed: [
      {
        id: 'subscription',
        organizationId: 'organization',
        organization: { members: [{ id: 'membership' }] },
      },
    ],
    pastDueCount: 0,
  });

  const result = await instance.run(NOW);

  assert.equal(result.reconciledCount, 0);
  // Telling an organization that has just paid that its payment failed is worse than silence.
  assert.deepEqual(notified, []);
});

test('an order LiqPay is no longer charging is not left for a hopeless retry', async () => {
  const { service, resolved } = checkoutService({
    subscription: { ...PENDING_SUBSCRIPTION, status: 'ACTIVE', liqpayOrderId: 'old-order' },
    unsubscribeOutcome: 'not-charging',
  });

  await service.cancel('organization', 'actor');

  // Nothing is charging, so retrying it nightly forever would achieve nothing.
  assert.deepEqual(resolved, ['old-order']);
});

test('a renewal with no callback is put to LiqPay before it is treated as unpaid', async () => {
  // Nothing here can tell a payment that failed from a callback that was lost, and the difference
  // is an organization that has paid being pushed into arrears and eventually into read-only.
  const { instance, asked, pastDue } = scheduler({
    unconfirmed: [
      {
        id: 'subscription',
        organizationId: 'organization',
        liqpayOrderId: 'order-1',
        organization: { members: [] },
      },
    ],
  });

  await instance.run(NOW);

  assert.deepEqual(asked, ['order-1']);
  // The guarded write still runs: it is what settles whether the confirmation moved the period
  // past the cutoff, and it already reports zero when the renewal turned up mid-pass.
  assert.equal(pastDue.length, 1);
});

test('a subscription with no order to ask about is reconciled the way it always was', async () => {
  const { instance, asked, pastDue, notified } = scheduler({
    unconfirmed: [
      {
        id: 'subscription',
        organizationId: 'organization',
        liqpayOrderId: null,
        organization: { members: [] },
      },
    ],
  });

  await instance.run(NOW);

  assert.deepEqual(asked, []);
  assert.equal(pastDue.length, 1);
  assert.equal(notified[0].titleKey, 'subscriptionPaymentFailed');
});

test('an organization LiqPay confirms as paid is never told its payment failed', async () => {
  // The confirmation moved the paid period past the cutoff, so the guarded write changes nothing -
  // the same path a callback arriving mid-pass has always taken.
  const { instance, notified } = scheduler({
    unconfirmed: [
      {
        id: 'subscription',
        organizationId: 'organization',
        liqpayOrderId: 'order-1',
        organization: { members: [] },
      },
    ],
    confirmedOrders: ['order-1'],
    pastDueCount: 0,
  });

  const result = await instance.run(NOW);

  assert.equal(result.reconciledCount, 0);
  assert.deepEqual(notified, []);
});
