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

function scheduler({ due = [], open = [], unconfirmed = [], pendingStops = [] } = {}) {
  const restricted = [];
  const pastDue = [];
  const notified = [];
  const stopped = [];

  const repository = {
    listRestrictionDue: async () => due,
    listTransitionWindowOpen: async () => open,
    listUnconfirmedRenewals: async () => unconfirmed,
    listPendingUnsubscribes: async () => pendingStops,
    markPastDue: async (id, graceEndsAt) => {
      pastDue.push({ id, graceEndsAt });
      return {};
    },
    restrict: async (id) => {
      restricted.push(id);
      return {};
    },
  };

  const billingService = {
    notifyOrganizationAdmins: async (input) => {
      notified.push(input);
    },
    stopSupersededOrder: async (id, orderId) => {
      stopped.push({ id, orderId });
      return orderId !== 'stubborn-order';
    },
  };

  const lock = {
    runOnce: async (name, job) => ({ skipped: false, result: await job() }),
  };

  return {
    instance: new BillingDunningScheduler(repository, billingService, lock),
    restricted,
    pastDue,
    notified,
    stopped,
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
    listPendingUnsubscribes: async () => [],
    restrict: async () => ({}),
  };

  const instance = new BillingDunningScheduler(
    repository,
    { notifyOrganizationAdmins: async () => undefined },
    { runOnce: async () => ({ skipped: true }) },
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
      { id: 'a', organizationId: 'org-a', pendingUnsubscribeOrderId: 'order-a' },
      { id: 'b', organizationId: 'org-b', pendingUnsubscribeOrderId: 'stubborn-order' },
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

function checkoutService({ subscription, unsubscribeOk = true, onCancel = () => {} }) {
  const started = [];
  const unsubscribed = [];

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
    return unsubscribeOk;
  };

  const service = new BillingService(
    {
      findByOrganizationId: async () => subscription,
      startPendingCheckout: async (input) => {
        started.push(input);
        return {};
      },
      cancel: async (...args) => {
        onCancel(args);
        return {};
      },
    },
    { listForOrganization: async () => [] },
    liqPayService,
    { getCurrent: async () => ({ usdToUah: 41.5, eurToUah: 48.2 }) },
    { createSubscriptionNotifications: async () => ({ createdCount: 0 }) },
  );

  return { service, started, unsubscribed };
}

const PENDING_SUBSCRIPTION = {
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

  // Currency and the USD reference are constants, so they land on the live row when the
  // checkout is paid for rather than being carried through the pending one.
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
  // The offered price is held aside; the live one is only replaced once a payment succeeds.
  assert.ok('amountMinor' in started[0]);
  assert.equal('currency' in started[0], false);
});

test('cancelling remembers an unsubscribe LiqPay would not accept', async () => {
  const canceled = [];
  const { service } = checkoutService({
    subscription: { ...PENDING_SUBSCRIPTION, status: 'ACTIVE', liqpayOrderId: 'old-order' },
    unsubscribeOk: false,
    onCancel: (args) => canceled.push(args),
  });

  await service.cancel('organization', 'actor');

  // Otherwise the card keeps being charged behind a subscription we show as cancelled.
  assert.deepEqual(canceled, [['organization', 'actor', 'old-order']]);
});

test('cancelling clears the retry when LiqPay accepts it', async () => {
  const canceled = [];
  const { service } = checkoutService({
    subscription: { ...PENDING_SUBSCRIPTION, status: 'ACTIVE', liqpayOrderId: 'old-order' },
    onCancel: (args) => canceled.push(args),
  });

  await service.cancel('organization', 'actor');

  assert.deepEqual(canceled, [['organization', 'actor', null]]);
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
