const assert = require('node:assert/strict');
const test = require('node:test');
const { Prisma } = require('@churchflow/db');
const {
  SubscriptionsRepository,
} = require('../dist/modules/billing/repositories/subscriptions.repository');
const { LiqPayService } = require('../dist/modules/billing/liqpay.service');
const { BillingService } = require('../dist/modules/billing/billing.service');
const {
  callbackRole,
  isOutOfOrderCallback,
  transitionForCallbackStatus,
} = require('../dist/modules/billing/subscription-transitions');
const {
  StaleSubscriptionStateError,
} = require('../dist/modules/billing/repositories/subscriptions.repository');
const { addMonths } = require('../dist/modules/billing/billing-time');

const PRIVATE_KEY = 'test_private_key';
const NOW = new Date('2026-09-01T12:00:00.000Z');

function liqPay(config = {}) {
  const values = {
    LIQPAY_PUBLIC_KEY: 'test_public_key',
    LIQPAY_PRIVATE_KEY: PRIVATE_KEY,
    LIQPAY_CALLBACK_URL: 'https://example.test/v1/billing/liqpay/callback',
    LIQPAY_RESULT_URL: 'https://example.test/dashboard',
    ...config,
  };

  return new LiqPayService({ get: (key) => values[key] });
}

function encode(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

test('the signature is sha1 over the base64 data, fenced by the private key', () => {
  // Pinned so a change of algorithm, encoding or concatenation order fails loudly rather than
  // silently rejecting every real callback.
  const data = encode({ action: 'pay', status: 'success', order_id: 'order-1', payment_id: 99 });

  assert.equal(
    data,
    'eyJhY3Rpb24iOiJwYXkiLCJzdGF0dXMiOiJzdWNjZXNzIiwib3JkZXJfaWQiOiJvcmRlci0xIiwicGF5bWVudF9pZCI6OTl9',
  );
  assert.equal(liqPay().sign(data), 's0ICLWL+eveH4XMfyeo8ZaNqOrg=');
});

test('a signature is accepted only for the exact payload it covers', () => {
  const service = liqPay();
  const data = encode({ status: 'success', order_id: 'order-1', payment_id: 1 });
  const signature = service.sign(data);

  assert.equal(service.verifySignature(data, signature), true);

  const tampered = encode({ status: 'success', order_id: 'order-2', payment_id: 1 });
  assert.equal(service.verifySignature(tampered, signature), false);
});

test('a signature of the wrong length is refused rather than throwing', () => {
  // timingSafeEqual throws on mismatched lengths; a forged short signature must not be a 500.
  const service = liqPay();
  const data = encode({ status: 'success' });

  assert.equal(service.verifySignature(data, 'short'), false);
  assert.equal(service.verifySignature(data, ''), false);
});

test('checkout pins amount and currency and never asks for card details', () => {
  const checkout = liqPay().buildSubscribeCheckout({
    orderId: 'order-1',
    amountMinor: 18_750,
    currency: 'UAH',
    description: 'ChurchFlow subscription - Grace Church',
    now: NOW,
  });

  const payload = JSON.parse(Buffer.from(checkout.data, 'base64').toString('utf8'));

  assert.equal(payload.action, 'subscribe');
  assert.equal(payload.amount, 187.5);
  assert.equal(payload.currency, 'UAH');
  assert.equal(payload.subscribe_periodicity, 'month');
  assert.equal(payload.order_id, 'order-1');
  assert.equal(payload.subscribe_date_start, '2026-09-01 12:00:00');
  assert.equal(checkout.checkoutUrl, 'https://www.liqpay.ua/api/3/checkout');
  assert.equal(liqPay().verifySignature(checkout.data, checkout.signature), true);
});

test('an unparseable callback body decodes to nothing instead of crashing', () => {
  assert.equal(liqPay().decodeCallback('not-base64-json'), null);
  assert.equal(liqPay().decodeCallback(encode('a string')), null);
});

test('a paid callback activates and sets the next period', () => {
  const next = transitionForCallbackStatus({
    current: { status: 'PAST_DUE', graceEndsAt: NOW, currentPeriodEndsAt: null },
    callbackStatus: 'success',
    now: NOW,
    isNewSubscription: false,
  });

  assert.equal(next.status, 'ACTIVE');
  assert.equal(next.graceEndsAt, null);
  assert.equal(next.currentPeriodEndsAt.toISOString(), '2026-10-01T12:00:00.000Z');
});

test('a first failure opens a seven day grace period', () => {
  const next = transitionForCallbackStatus({
    current: { status: 'ACTIVE', graceEndsAt: null, currentPeriodEndsAt: NOW },
    callbackStatus: 'failure',
    now: NOW,
    isNewSubscription: false,
  });

  assert.equal(next.status, 'PAST_DUE');
  assert.equal(next.graceEndsAt.toISOString(), '2026-09-08T12:00:00.000Z');
});

test('a repeated failure does not push the grace deadline further out', () => {
  // Otherwise a card that keeps failing buys unlimited time.
  const graceEndsAt = new Date('2026-09-05T00:00:00.000Z');
  const next = transitionForCallbackStatus({
    current: { status: 'PAST_DUE', graceEndsAt, currentPeriodEndsAt: null },
    callbackStatus: 'failure',
    now: NOW,
    isNewSubscription: false,
  });

  assert.equal(next.graceEndsAt.toISOString(), graceEndsAt.toISOString());
});

test('a failure after restriction does not hand write access back', () => {
  const next = transitionForCallbackStatus({
    current: { status: 'RESTRICTED', graceEndsAt: null, currentPeriodEndsAt: null },
    callbackStatus: 'failure',
    now: NOW,
    isNewSubscription: false,
  });

  assert.equal(next, null);
});

test('a reversal is treated as unpaid', () => {
  const next = transitionForCallbackStatus({
    current: { status: 'ACTIVE', graceEndsAt: null, currentPeriodEndsAt: null },
    callbackStatus: 'reversed',
    now: NOW,
    isNewSubscription: false,
  });

  assert.equal(next.status, 'PAST_DUE');
});

test('unsubscribing preserves the paid period and seven days of grace', () => {
  const next = transitionForCallbackStatus({
    current: { status: 'ACTIVE', graceEndsAt: null, currentPeriodEndsAt: NOW },
    callbackStatus: 'unsubscribed',
    now: NOW,
    isNewSubscription: false,
  });

  assert.equal(next.status, 'ACTIVE');
  assert.equal(next.graceEndsAt.toISOString(), '2026-09-08T12:00:00.000Z');
  assert.equal(next.cancelRequestedAt, NOW);
});

test('a stray charge credits paid access without reviving auto-renewal', () => {
  // The organization asked to stop. A payment that lands anyway - one already in flight, or a
  // LiqPay unsubscribe that never took - must not put it back on the hook.
  const next = transitionForCallbackStatus({
    current: { status: 'CANCELED', graceEndsAt: null, currentPeriodEndsAt: NOW },
    callbackStatus: 'success',
    now: NOW,
    isNewSubscription: false,
  });

  assert.equal(next.status, 'ACTIVE');
  assert.deepEqual(next.cancelRequestedAt, NOW);
  assert.deepEqual(next.graceEndsAt, new Date('2026-10-08T12:00:00Z'));
});

test('a checkout the organization started does revive a cancelled subscription', () => {
  const next = transitionForCallbackStatus({
    current: { status: 'CANCELED', graceEndsAt: null, currentPeriodEndsAt: NOW },
    callbackStatus: 'success',
    now: NOW,
    isNewSubscription: true,
  });

  assert.equal(next.status, 'ACTIVE');
});

test('a failed checkout leaves the running subscription alone', () => {
  // The replacement card was declined; that says nothing about the card already paying.
  for (const status of ['failure', 'error', 'unsubscribed']) {
    const next = transitionForCallbackStatus({
      current: { status: 'ACTIVE', graceEndsAt: null, currentPeriodEndsAt: NOW },
      callbackStatus: status,
      now: NOW,
      isNewSubscription: true,
    });

    assert.equal(next, null, status);
  }
});

test('a month is added by calendar, not by overflow', () => {
  // setUTCMonth turns 31 January into 3 March and skips February entirely, which would put a
  // wrong next charge date in front of every organization subscribing at a month end.
  const cases = [
    ['2026-01-31T12:00:00.000Z', '2026-02-28T12:00:00.000Z'],
    ['2028-01-31T12:00:00.000Z', '2028-02-29T12:00:00.000Z'],
    ['2026-08-31T12:00:00.000Z', '2026-09-30T12:00:00.000Z'],
    ['2026-12-15T12:00:00.000Z', '2027-01-15T12:00:00.000Z'],
  ];

  for (const [from, expected] of cases) {
    assert.equal(addMonths(new Date(from), 1).toISOString(), expected, from);
  }
});

test('an undecided status changes nothing', () => {
  for (const status of ['wait_accept', 'wait_secure', '3ds_verify', 'processing', '']) {
    const next = transitionForCallbackStatus({
      current: { status: 'ACTIVE', graceEndsAt: null, currentPeriodEndsAt: null },
      callbackStatus: status,
      now: NOW,
      isNewSubscription: false,
    });

    assert.equal(next, null, status);
  }
});

function billingService({
  subscription,
  checkoutOrder = null,
  duplicate = false,
  unsubscribeOk = true,
  // How many times the write refuses the state it was handed before it is allowed through.
  staleAttempts = 0,
  // What the callback log already holds: the newest event applied to this subscription, and
  // whether the payment being reported is already recorded as failed.
  lastEventAt = null,
  paymentAlreadyFailed = false,
} = {}) {
  const applied = [];
  const notified = [];
  const unsubscribed = [];
  const cleared = [];
  const warned = [];
  // Checkout orders are kept for real rather than stubbed away: reuse is the layer that stops a
  // second payable LiqPay page from existing, so it has to be exercised against stored rows.
  const orders = [];
  const rates = { usdToUah: 41.5, eurToUah: 48.2 };

  const repository = {
    findByOrganizationId: async () =>
      subscription && { ...subscription, organization: { id: 'organization', name: 'Grace' } },
    findByOrderId: async () => (subscription ? { subscription, checkoutOrder } : null),
    findReusableCheckout: async ({ subscriptionId, amountMinor, createdAfter }) =>
      orders.find(
        (order) =>
          order.subscriptionId === subscriptionId &&
          order.status === 'PROPOSED' &&
          order.amountMinor === amountMinor &&
          order.createdAt >= createdAfter,
      ) ?? null,
    createCheckoutOrder: async (input) => {
      const order = {
        id: `checkout-${orders.length + 1}`,
        status: 'PROPOSED',
        createdAt: new Date(),
        ...input,
      };
      orders.push(order);

      return order;
    },
    applyCallback: async (input) => {
      applied.push(input);

      if (applied.length <= staleAttempts) {
        throw new StaleSubscriptionStateError('subscription');
      }

      return { duplicate };
    },
    findPaymentHistory: async () => ({ lastEventAt, paymentAlreadyFailed }),
    resolveUnsubscribeRequest: async (orderId) => {
      cleared.push(orderId);
      return { count: 1 };
    },
    listAdminMembershipIds: async () => [{ id: 'membership' }],
  };

  const liqPayService = liqPay();
  liqPayService.unsubscribe = async (orderId) => {
    unsubscribed.push(orderId);
    return unsubscribeOk ? 'stopped' : 'retry';
  };

  const service = new BillingService(
    repository,
    { listForOrganization: async () => [] },
    liqPayService,
    { getCurrent: async () => rates },
    {
      createSubscriptionNotifications: async (input) => {
        notified.push(input);
        return { createdCount: 1 };
      },
    },
  );

  service.logger = {
    error: (entry) => warned.push(entry),
    warn: (entry) => warned.push(entry),
    log: () => {},
  };

  return { service, applied, notified, unsubscribed, cleared, orders, rates, warned };
}

function checkoutOrderRow(overrides = {}) {
  return {
    id: 'checkout-1',
    organizationId: 'organization',
    subscriptionId: 'subscription',
    orderId: 'new-order',
    amountMinor: 19_000,
    currency: 'UAH',
    usdReference: 4.5,
    fxRateUsedAt: new Date('2026-08-30T00:00:00.000Z'),
    status: 'PROPOSED',
    ...overrides,
  };
}

function signedCallback(payload) {
  const data = encode({ amount: 190, currency: 'UAH', ...payload });

  return { data, signature: liqPay().sign(data) };
}

const ACTIVE_SUBSCRIPTION = {
  amountMinor: 19000,
  currency: 'UAH',
  cancelRequestedAt: null,
  updatedAt: NOW,
  unsubscribeRequests: [],
  id: 'subscription',
  organizationId: 'organization',
  status: 'ACTIVE',
  graceEndsAt: null,
  currentPeriodEndsAt: null,
  isExempt: false,
  liqpayOrderId: 'order-1',
};

test('a callback with a bad signature is refused before anything is read', async () => {
  const { service, applied } = billingService({ subscription: ACTIVE_SUBSCRIPTION });
  const { data } = signedCallback({ status: 'success', order_id: 'o', payment_id: 1 });

  await assert.rejects(() => service.handleCallback(data, 'AAAA'), /signature/i);
  assert.equal(applied.length, 0);
});

test('a callback without a payment id is refused, because it could not be deduplicated', async () => {
  const { service, applied } = billingService({ subscription: ACTIVE_SUBSCRIPTION });
  const { data, signature } = signedCallback({ status: 'success', order_id: 'order-1' });

  await assert.rejects(() => service.handleCallback(data, signature), /payment id/i);
  assert.equal(applied.length, 0);
});

test('a callback for an unknown order is acknowledged, not retried forever', async () => {
  const { service, applied } = billingService({ subscription: null });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'ghost',
    payment_id: 1,
  });

  assert.deepEqual(await service.handleCallback(data, signature), { ok: true });
  assert.equal(applied.length, 0);
});

test('a successful callback stores the card display data and notifies', async () => {
  const { service, applied, notified } = billingService({
    subscription: { ...ACTIVE_SUBSCRIPTION, status: 'PAST_DUE' },
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'order-1',
    payment_id: 42,
    sender_card_mask2: '424242******4242',
    sender_card_type: 'visa',
  });

  await service.handleCallback(data, signature, NOW);

  assert.equal(applied[0].paymentId, '42');
  assert.equal(applied[0].update.status, 'ACTIVE');
  assert.equal(applied[0].update.cardMask, '424242******4242');
  assert.equal(applied[0].update.cardBrand, 'visa');
  assert.equal(notified[0].type, 'SUBSCRIPTION_RENEWED');
  assert.equal(notified[0].adminOnly, true);
});

test('a replayed callback applies nothing and notifies nobody twice', async () => {
  const { service, notified } = billingService({
    subscription: ACTIVE_SUBSCRIPTION,
    duplicate: true,
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'order-1',
    payment_id: 42,
  });

  assert.deepEqual(await service.handleCallback(data, signature, NOW), { ok: true });
  assert.equal(notified.length, 0);
});

test('an undecided callback is still recorded, but changes no state', async () => {
  const { service, applied, notified } = billingService({ subscription: ACTIVE_SUBSCRIPTION });
  const { data, signature } = signedCallback({
    status: 'wait_secure',
    order_id: 'order-1',
    payment_id: 7,
  });

  await service.handleCallback(data, signature, NOW);

  assert.equal(applied.length, 1);
  assert.equal(applied[0].update, null);
  assert.equal(notified.length, 0);
});

test('paying for a replacement promotes it and retires the order it replaces', async () => {
  const order = checkoutOrderRow();
  const { service, applied, unsubscribed, cleared } = billingService({
    subscription: { ...ACTIVE_SUBSCRIPTION, liqpayOrderId: 'old-order' },
    checkoutOrder: order,
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'new-order',
    payment_id: 55,
  });

  await service.handleCallback(data, signature, NOW);

  const update = applied[0].update;
  assert.equal(update.liqpayOrderId, 'new-order');
  // The price offered at checkout becomes the live price only now, once it has been paid.
  assert.equal(update.amountMinor, 19_000);
  assert.equal(update.fxRateUsedAt, order.fxRateUsedAt);
  // The order it replaces is queued in the same transaction as the swap, so an order LiqPay is
  // still charging can never be left with nothing that knows to stop it.
  assert.equal(applied[0].unsubscribeOrderId, 'old-order');

  // The paid order is closed, and with it every sibling still open at LiqPay.
  assert.deepEqual(applied[0].checkout, { id: 'checkout-1', outcome: 'paid' });

  // The old order is stopped only after the swap is committed, never hopefully in advance.
  assert.deepEqual(unsubscribed, ['old-order']);
  assert.deepEqual(cleared, ['old-order']);
});

test('an order LiqPay refuses to stop is kept for the dunning job to retry', async () => {
  const { service, applied, cleared } = billingService({
    subscription: { ...ACTIVE_SUBSCRIPTION, liqpayOrderId: 'old-order' },
    checkoutOrder: checkoutOrderRow(),
    unsubscribeOk: false,
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'new-order',
    payment_id: 56,
  });

  await service.handleCallback(data, signature, NOW);

  assert.equal(applied[0].unsubscribeOrderId, 'old-order');
  assert.deepEqual(cleared, []);
});

test('a renewal of the running subscription does not disturb its order ids', async () => {
  // The live order still has the checkout row it was created from, and LiqPay reports every
  // monthly charge against that same order id. Treating those as fresh checkouts would re-pin the
  // price on each renewal.
  const { service, applied } = billingService({
    subscription: ACTIVE_SUBSCRIPTION,
    checkoutOrder: checkoutOrderRow({ orderId: 'order-1', status: 'PAID' }),
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'order-1',
    payment_id: 57,
  });

  await service.handleCallback(data, signature, NOW);

  assert.equal('liqpayOrderId' in applied[0].update, false);
  assert.equal('amountMinor' in applied[0].update, false);
  assert.equal(applied[0].checkout, null);
});

test('a failed payment notifies with the grace deadline', async () => {
  const { service, notified } = billingService({ subscription: ACTIVE_SUBSCRIPTION });
  const { data, signature } = signedCallback({
    status: 'failure',
    order_id: 'order-1',
    payment_id: 8,
  });

  await service.handleCallback(data, signature, NOW);

  assert.equal(notified[0].type, 'SUBSCRIPTION_PAYMENT_FAILED');
  assert.equal(notified[0].bodyMessage.deadline, '2026-09-08T12:00:00.000Z');
});

function orderIdOf(checkout) {
  return JSON.parse(Buffer.from(checkout.data, 'base64').toString('utf8')).order_id;
}

const PENDING_SUBSCRIPTION = {
  amountMinor: null,
  currency: null,
  cancelRequestedAt: null,
  updatedAt: NOW,
  unsubscribeRequests: [],
  ...ACTIVE_SUBSCRIPTION,
  status: 'PENDING',
  liqpayOrderId: null,
};

test('clicking subscribe twice offers the same order rather than a second payable page', async () => {
  // Two orders would mean two LiqPay pages, either of which can still be paid; the one that is
  // not the subscription's own order used to produce a callback matching nothing at all.
  const { service, orders } = billingService({ subscription: PENDING_SUBSCRIPTION });

  const first = await service.startCheckout('organization', 'user');
  const second = await service.startCheckout('organization', 'user');

  assert.equal(orderIdOf(first), orderIdOf(second));
  assert.equal(orders.length, 1);
});

test('a checkout priced from a new rate gets its own order, and both stay matchable', async () => {
  const { service, orders, rates } = billingService({ subscription: PENDING_SUBSCRIPTION });

  const first = await service.startCheckout('organization', 'user');
  rates.usdToUah = 43.75;
  const second = await service.startCheckout('organization', 'user');

  assert.notEqual(orderIdOf(first), orderIdOf(second));
  assert.equal(orders.length, 2);
  assert.deepEqual(
    orders.map((order) => order.orderId),
    [orderIdOf(first), orderIdOf(second)],
  );
  assert.equal(orders[0].amountMinor, 18_675);
  assert.equal(orders[1].amountMinor, 19_688);
});

test('paying for a superseded checkout activates it at the price that checkout pinned', async () => {
  // The payer opened checkout twice and paid in the older tab. The subscription no longer points
  // at that order, so the amount has to come from the order's own row.
  const superseded = checkoutOrderRow({
    id: 'checkout-1',
    orderId: 'first-order',
    amountMinor: 18_675,
    fxRateUsedAt: new Date('2026-08-29T00:00:00.000Z'),
  });
  const { service, applied } = billingService({
    subscription: PENDING_SUBSCRIPTION,
    checkoutOrder: superseded,
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'first-order',
    payment_id: 61,
    amount: 186.75,
  });

  await service.handleCallback(data, signature, NOW);

  assert.equal(applied[0].update.status, 'ACTIVE');
  assert.equal(applied[0].update.liqpayOrderId, 'first-order');
  assert.equal(applied[0].update.amountMinor, 18_675);
  assert.equal(applied[0].update.fxRateUsedAt, superseded.fxRateUsedAt);
  assert.deepEqual(applied[0].checkout, { id: 'checkout-1', outcome: 'paid' });
});

test('a callback charging something else is reported, not adopted as the price', async () => {
  const { service, applied, warned } = billingService({
    subscription: PENDING_SUBSCRIPTION,
    checkoutOrder: checkoutOrderRow(),
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'new-order',
    payment_id: 62,
    amount: 1,
    currency: 'UAH',
  });

  await service.handleCallback(data, signature, NOW);

  assert.equal(applied[0].update, null);
  assert.equal(applied[0].issue, 'payment-price-mismatch');
  assert.equal(applied[0].credited, false);
  assert.equal(warned.length, 1);
});

test('a failed checkout closes its order, an undecided one leaves it open', async () => {
  // wait_secure may still become a payment. Retiring the order early would make that payment
  // unmatchable - the exact failure the order table exists to prevent.
  for (const [status, expected] of [
    ['failure', { id: 'checkout-1', outcome: 'abandoned' }],
    ['wait_secure', null],
  ]) {
    const { service, applied } = billingService({
      subscription: PENDING_SUBSCRIPTION,
      checkoutOrder: checkoutOrderRow(),
    });
    const { data, signature } = signedCallback({
      status,
      order_id: 'new-order',
      payment_id: 63,
    });

    await service.handleCallback(data, signature, NOW);

    assert.deepEqual(applied[0].checkout, expected, status);
  }
});

function uniqueViolation(target) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

function callbackRepository({
  stored = [],
  subscriptionUpdateClashes = false,
  // Zero means the guard matched nothing: the subscription moved between being read and written.
  subscriptionUpdateCount = 1,
} = {}) {
  const callbacks = stored.map((row) => ({ ...row }));
  const queued = [];
  const guarded = [];
  const closedCheckouts = [];

  const matches = (row, where) =>
    row.orderId === where.orderId &&
    row.paymentId === where.paymentId &&
    (where.OR
      ? where.OR.some(
          (condition) => condition.status === row.status || (condition.credited && row.credited),
        )
      : row.status === where.status);

  const tx = {
    billingCallback: {
      create: async ({ data }) => {
        if (
          callbacks.some(
            (row) =>
              matches(row, data) ||
              (data.credited &&
                row.credited &&
                row.orderId === data.orderId &&
                row.paymentId === data.paymentId),
          )
        ) {
          throw uniqueViolation('billing_callbacks_order_id_payment_id_status_key');
        }

        callbacks.push(data);

        return data;
      },
    },
    billingCheckoutOrder: {
      update: async () => ({}),
      updateMany: async (args) => {
        closedCheckouts.push(args.where);

        return { count: 0 };
      },
    },
    billingUnsubscribeRequest: {
      updateMany: async () => ({ count: 1 }),
      upsert: async ({ create }) => {
        queued.push(create.orderId);

        return create;
      },
    },
    subscription: {
      updateMany: async (args) => {
        if (subscriptionUpdateClashes) {
          throw uniqueViolation('subscriptions_liqpay_order_id_key');
        }

        guarded.push(args.where);

        return { count: subscriptionUpdateCount };
      },
    },
    auditLog: { create: async () => ({}) },
  };

  const prisma = {
    // Rolled back like the real thing: a transaction that failed leaves no callback row behind,
    // and that is exactly what separates a genuine redelivery from a collision elsewhere.
    $transaction: async (run) => {
      const committed = callbacks.length;

      try {
        return await run(tx);
      } catch (error) {
        callbacks.length = committed;
        throw error;
      }
    },
    billingCallback: {
      findFirst: async ({ where }) => callbacks.find((row) => matches(row, where)) ?? null,
    },
  };

  return {
    repository: new SubscriptionsRepository(prisma),
    callbacks,
    queued,
    guarded,
    closedCheckouts,
  };
}

function callbackInput(overrides = {}) {
  return {
    subscriptionId: 'subscription',
    organizationId: 'organization',
    orderId: 'order-1',
    paymentId: '99',
    status: 'success',
    previousStatus: 'PENDING',
    nextStatus: 'ACTIVE',
    expectedLiqpayOrderId: null,
    expectedCancelRequestedAt: null,
    expectedUpdatedAt: NOW,
    credited: false,
    issue: null,
    payload: {},
    update: { status: 'ACTIVE' },
    checkout: null,
    unsubscribeOrderId: null,
    abandonOpenCheckouts: false,
    ...overrides,
  };
}

test('the decision of a 3DS payment applies, rather than being swallowed by the wait before it', async () => {
  // LiqPay reports both stages of one payment under the same payment id. Deduplicating without
  // the status meant the card was charged and the subscription stayed PENDING until the next
  // month's renewal - if the organization had not already been restricted by then.
  const { repository, callbacks } = callbackRepository();

  const undecided = await repository.applyCallback(
    callbackInput({ status: 'wait_secure', nextStatus: null, update: null }),
  );
  const decisive = await repository.applyCallback(callbackInput({ status: 'success' }));

  assert.equal(undecided.duplicate, false);
  assert.equal(decisive.duplicate, false);
  assert.equal(callbacks.length, 2);
});

test('the same stage delivered twice is still a no-op', async () => {
  const { repository, callbacks } = callbackRepository({
    stored: [{ orderId: 'order-1', paymentId: '99', status: 'success' }],
  });

  const replay = await repository.applyCallback(callbackInput());

  assert.equal(replay.duplicate, true);
  assert.equal(callbacks.length, 1);
});

test('a clash somewhere else in the transaction is not reported as a delivered callback', async () => {
  // Reporting it as a duplicate would drop a callback that changed nothing, and LiqPay would
  // never retry it.
  const { repository } = callbackRepository({ subscriptionUpdateClashes: true });

  await assert.rejects(() => repository.applyCallback(callbackInput()), /unique constraint/i);
});

test('the order a payment supersedes is queued with the state change, not after it', async () => {
  const { repository, queued } = callbackRepository();

  await repository.applyCallback(callbackInput({ unsubscribeOrderId: 'old-order' }));

  assert.deepEqual(queued, ['old-order']);
});

function silentLiqPay() {
  const service = liqPay();
  service.logger = { error: () => {}, warn: () => {}, log: () => {} };

  return service;
}

function liqPayResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, text: async () => body };
}

async function withFetch(response, run) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => response;

  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test('an unsubscribe LiqPay refused is not mistaken for a cancellation', async () => {
  // 200 is how LiqPay answers a refusal too. Reading only the status code resolved the queued
  // request, stopped every retry, and left the card being charged month after month.
  const outcome = await withFetch(liqPayResponse('{"result":"error","err_code":"internal"}'), () =>
    silentLiqPay().unsubscribe('order-1'),
  );

  assert.equal(outcome, 'retry');
});

test('an order LiqPay no longer charges needs no retry that could never succeed', async () => {
  const outcome = await withFetch(
    liqPayResponse('{"result":"error","err_code":"payment_not_subscribed"}'),
    () => silentLiqPay().unsubscribe('order-1'),
  );

  assert.equal(outcome, 'not-charging');
});

test('an accepted unsubscribe is reported as stopped, however LiqPay phrases it', async () => {
  for (const body of ['{"result":"ok"}', '{"status":"unsubscribed"}']) {
    const outcome = await withFetch(liqPayResponse(body), () =>
      silentLiqPay().unsubscribe('order-1'),
    );

    assert.equal(outcome, 'stopped', body);
  }
});

test('an unreadable or rejected unsubscribe is retried rather than assumed', async () => {
  const unreadable = await withFetch(liqPayResponse('<html>gateway</html>'), () =>
    silentLiqPay().unsubscribe('order-1'),
  );
  const rejected = await withFetch(liqPayResponse('', { ok: false, status: 502 }), () =>
    silentLiqPay().unsubscribe('order-1'),
  );

  assert.equal(unreadable, 'retry');
  assert.equal(rejected, 'retry');
});

test('a callback is judged by the order it names, not only by the order id', () => {
  assert.equal(callbackRole({ checkoutStatus: null, isLiveOrder: true }), 'renewal');
  assert.equal(callbackRole({ checkoutStatus: 'PAID', isLiveOrder: true }), 'renewal');
  assert.equal(callbackRole({ checkoutStatus: 'PROPOSED', isLiveOrder: false }), 'new-checkout');
  // Abandoned by a cancellation, or already replaced by the order that is live now. Comparing
  // order ids alone made both of these look like a purchase the organization had just made.
  assert.equal(
    callbackRole({ checkoutStatus: 'ABANDONED', isLiveOrder: false }),
    'retired-checkout',
  );
  assert.equal(callbackRole({ checkoutStatus: 'PAID', isLiveOrder: false }), 'retired-checkout');
});

test('paying for a checkout a cancellation closed does not revive the subscription', async () => {
  // The tab left open on the LiqPay page after cancelling. The payment is real, so the order it
  // created has to be stopped - but it must not hand the organization its subscription back.
  const { service, applied, unsubscribed, notified } = billingService({
    subscription: { ...ACTIVE_SUBSCRIPTION, status: 'CANCELED', liqpayOrderId: 'old-order' },
    checkoutOrder: checkoutOrderRow({ status: 'ABANDONED' }),
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'new-order',
    payment_id: 81,
  });

  await service.handleCallback(data, signature, NOW);

  assert.equal(applied[0].update, null);
  assert.equal(applied[0].nextStatus, null);
  assert.equal(applied[0].unsubscribeOrderId, 'new-order');
  assert.deepEqual(unsubscribed, ['new-order']);
  assert.equal(notified[0].titleKey, 'subscriptionPaymentReview');
});

test('a charge on an order that has been replaced does not take the live one back', async () => {
  // The replaced order keeps charging until LiqPay accepts the unsubscribe, so its monthly
  // callback does arrive - with a payment id of its own, past the redelivery guard. Honouring it
  // re-pinned last month's price and queued the subscription the organization is actually on.
  const { service, applied, unsubscribed } = billingService({
    subscription: { ...ACTIVE_SUBSCRIPTION, liqpayOrderId: 'live-order' },
    checkoutOrder: checkoutOrderRow({ status: 'PAID', orderId: 'old-order' }),
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'old-order',
    payment_id: 82,
  });

  await service.handleCallback(data, signature, NOW);

  assert.equal(applied[0].update, null);
  assert.equal(applied[0].unsubscribeOrderId, 'old-order');
  assert.deepEqual(unsubscribed, ['old-order']);
});

test('a failed charge on a retired order stops nothing and changes nothing', async () => {
  const { service, applied, unsubscribed } = billingService({
    subscription: { ...ACTIVE_SUBSCRIPTION, liqpayOrderId: 'live-order' },
    checkoutOrder: checkoutOrderRow({ status: 'ABANDONED', orderId: 'old-order' }),
  });
  const { data, signature } = signedCallback({
    status: 'failure',
    order_id: 'old-order',
    payment_id: 83,
  });

  await service.handleCallback(data, signature, NOW);

  assert.equal(applied[0].update, null);
  assert.equal(applied[0].unsubscribeOrderId, null);
  assert.deepEqual(unsubscribed, []);
});

test('the state a callback was decided against travels with the write', async () => {
  const { service, applied } = billingService({
    subscription: { ...ACTIVE_SUBSCRIPTION, liqpayOrderId: 'live-order' },
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'live-order',
    payment_id: 84,
  });

  await service.handleCallback(data, signature, NOW);

  assert.equal(applied[0].expectedLiqpayOrderId, 'live-order');
  assert.equal(applied[0].previousStatus, 'ACTIVE');
});

test('a callback that lost a race is decided again rather than layered on top', async () => {
  const { service, applied } = billingService({
    subscription: ACTIVE_SUBSCRIPTION,
    staleAttempts: 1,
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'order-1',
    payment_id: 85,
  });

  await service.handleCallback(data, signature, NOW);

  assert.equal(applied.length, 2);
});

test('a callback that keeps losing fails loudly, so LiqPay delivers it again', async () => {
  // A silent 200 here would be a payment LiqPay considers settled and we never applied.
  const { service, applied } = billingService({
    subscription: ACTIVE_SUBSCRIPTION,
    staleAttempts: Number.MAX_SAFE_INTEGER,
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'order-1',
    payment_id: 86,
  });

  await assert.rejects(() => service.handleCallback(data, signature, NOW));
  assert.equal(applied.length, 3);
});

test('the state a callback was judged against guards the write', async () => {
  const { repository, guarded } = callbackRepository();

  await repository.applyCallback(
    callbackInput({ previousStatus: 'PENDING', expectedLiqpayOrderId: 'live-order' }),
  );

  assert.deepEqual(guarded[0], {
    id: 'subscription',
    status: 'PENDING',
    liqpayOrderId: 'live-order',
    cancelRequestedAt: null,
    updatedAt: NOW,
  });
});

test('a subscription that moved under a callback refuses it instead of overwriting', async () => {
  // Two payments for different orders read the same subscription before either wrote. Without
  // this the second one landed on state the first had replaced, and the order it displaced went
  // on charging with nothing queued to stop it.
  const { repository, callbacks } = callbackRepository({ subscriptionUpdateCount: 0 });

  await assert.rejects(
    () => repository.applyCallback(callbackInput()),
    (error) => error instanceof StaleSubscriptionStateError,
  );

  // Rolled back with the transaction: a callback that changed nothing must not look delivered.
  assert.deepEqual(callbacks, []);
});

test('provider unsubscribe preserves access without reporting a renewal or changing its charge date', async () => {
  const { service, applied, notified } = billingService({
    subscription: { ...ACTIVE_SUBSCRIPTION, currentPeriodEndsAt: new Date('2026-10-01T12:00:00Z') },
  });
  const data = encode({
    order_id: 'order',
    payment_id: 'unsubscribe-event',
    status: 'unsubscribed',
  });
  await service.handleCallback(data, liqPay().sign(data), NOW);
  assert.equal(applied[0].update.status, 'ACTIVE');
  assert.deepEqual(applied[0].update.cancelRequestedAt, NOW);
  assert.equal('liqpaySubscribedAt' in applied[0].update, false);
  // Nothing was cancelled before this callback, so there is no earlier request for it to update:
  // LiqPay stopping the subscription on its own is the request.
  assert.equal(notified[0].titleKey, 'subscriptionCancellationRequested');
});

test('a payment reversed after cancellation shortens access instead of reporting it credited', async () => {
  const { service, applied, notified, unsubscribed } = billingService({
    subscription: {
      ...ACTIVE_SUBSCRIPTION,
      cancelRequestedAt: NOW,
      currentPeriodEndsAt: new Date('2026-10-01T12:00:00Z'),
      graceEndsAt: new Date('2026-10-08T12:00:00Z'),
    },
  });
  const { data, signature } = signedCallback({
    order_id: 'order-1',
    payment_id: 'chargeback',
    status: 'reversed',
  });
  await service.handleCallback(data, signature, NOW);
  assert.deepEqual(applied[0].update.graceEndsAt, new Date('2026-09-08T12:00:00Z'));
  assert.deepEqual(applied[0].update.cancelRequestedAt, NOW);
  assert.equal(applied[0].credited, false);
  assert.deepEqual(unsubscribed, []);
  // "Any additional payment has been credited" is the one thing a chargeback must not say.
  assert.equal(notified[0].titleKey, 'subscriptionPaymentFailed');
  assert.equal(notified[0].bodyMessage.deadline, '2026-09-08T12:00:00.000Z');
});

test('a late charge after requesting cancellation credits access without restarting renewal', async () => {
  const { service, applied, unsubscribed, notified } = billingService({
    subscription: {
      ...ACTIVE_SUBSCRIPTION,
      cancelRequestedAt: NOW,
      graceEndsAt: new Date('2026-10-08T12:00:00Z'),
    },
  });
  const data = encode({
    order_id: 'order-1',
    payment_id: 'late-charge',
    status: 'success',
    amount: 190,
    currency: 'UAH',
  });
  await service.handleCallback(data, liqPay().sign(data), NOW);
  assert.equal(applied[0].update.status, 'ACTIVE');
  assert.deepEqual(applied[0].update.cancelRequestedAt, NOW);
  assert.deepEqual(applied[0].update.graceEndsAt, new Date('2026-10-08T12:00:00Z'));
  assert.equal(applied[0].credited, true);
  assert.equal(applied[0].unsubscribeOrderId, 'order-1');
  assert.deepEqual(unsubscribed, ['order-1']);
  assert.equal(notified[0].titleKey, 'subscriptionCancellationUpdated');
});

test('one payment cannot credit two periods through success and subscribed callbacks', async () => {
  const { repository, callbacks, guarded } = callbackRepository();
  const first = await repository.applyCallback(callbackInput({ credited: true }));
  const second = await repository.applyCallback(
    callbackInput({ credited: true, status: 'subscribed' }),
  );
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(callbacks.length, 1);
  assert.equal(guarded.length, 1);
});

test('only the callback that records a cancellation closes the checkouts left open', async () => {
  // The update carries the cancellation forward on every later charge too, so deciding from it
  // would abandon whatever checkout the organization had opened to subscribe again.
  const update = { status: 'ACTIVE', cancelRequestedAt: NOW };

  const carried = callbackRepository();
  await carried.repository.applyCallback(callbackInput({ update, abandonOpenCheckouts: false }));
  assert.deepEqual(carried.closedCheckouts, []);

  const recorded = callbackRepository();
  await recorded.repository.applyCallback(callbackInput({ update, abandonOpenCheckouts: true }));
  assert.deepEqual(recorded.closedCheckouts, [
    { subscriptionId: 'subscription', status: 'PROPOSED' },
  ]);
});

test('a paid renewal without a checkout record still validates the pinned price and currency', async () => {
  for (const payload of [{ amount: 1 }, { currency: 'USD' }]) {
    const { service, applied, notified, unsubscribed } = billingService({
      subscription: ACTIVE_SUBSCRIPTION,
    });
    const { data, signature } = signedCallback({
      status: 'success',
      order_id: 'order-1',
      payment_id: 'mismatch',
      ...payload,
    });
    await service.handleCallback(data, signature, NOW);
    assert.equal(applied[0].update, null);
    assert.equal(applied[0].credited, false);
    assert.equal(applied[0].issue, 'payment-price-mismatch');
    assert.equal(notified[0].titleKey, 'subscriptionPaymentReview');
    // Withholding credit is doubt about one charge. Cancelling the order it arrived on would end
    // the payer's subscription at LiqPay over a price we are only refusing to trust.
    assert.equal(applied[0].unsubscribeOrderId, null);
    assert.deepEqual(unsubscribed, []);
  }
});

test('a price we never pinned is reported without withholding the access it paid for', async () => {
  // Subscriptions activated before checkout orders existed have no price to compare against, and
  // LiqPay may leave the amount out of a callback its signature has already proven genuine.
  // Neither is the payer's doing, so the charge is credited and the gap is recorded on the row.
  for (const [subscription, payload] of [
    [{ ...ACTIVE_SUBSCRIPTION, amountMinor: null, currency: null }, {}],
    [ACTIVE_SUBSCRIPTION, { amount: null }],
    [ACTIVE_SUBSCRIPTION, { currency: null }],
  ]) {
    const { service, applied, notified, unsubscribed } = billingService({ subscription });
    const { data, signature } = signedCallback({
      status: 'success',
      order_id: 'order-1',
      payment_id: 'renewal',
      ...payload,
    });
    await service.handleCallback(data, signature, NOW);
    assert.equal(applied[0].issue, 'unverifiable-price');
    assert.equal(applied[0].credited, true);
    assert.equal(applied[0].update.status, 'ACTIVE');
    assert.equal(applied[0].unsubscribeOrderId, null);
    assert.deepEqual(unsubscribed, []);
    assert.equal(notified[0].titleKey, 'subscriptionRenewed');
  }
});

test('a checkout we refuse to honour is stopped at LiqPay rather than left charging', async () => {
  // The mirror of the renewal case: nothing here is live yet, so the purchase is not recognised
  // and the order that would go on charging monthly has to be cancelled.
  const { service, applied, unsubscribed, notified } = billingService({
    subscription: ACTIVE_SUBSCRIPTION,
    checkoutOrder: checkoutOrderRow(),
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'new-order',
    payment_id: 'mismatch',
    amount: 1,
  });
  await service.handleCallback(data, signature, NOW);
  assert.equal(applied[0].issue, 'payment-price-mismatch');
  assert.equal(applied[0].credited, false);
  assert.equal(applied[0].update, null);
  assert.equal(applied[0].unsubscribeOrderId, 'new-order');
  assert.deepEqual(unsubscribed, ['new-order']);
  assert.equal(notified[0].titleKey, 'subscriptionPaymentReview');
});

test('a late charge on the old order leaves a re-subscribe checkout open', async () => {
  // The organization cancelled, then started subscribing again. A charge still in flight on the
  // old order carries the cancellation forward, and closing the new checkout over it would take
  // the money for a subscription that no longer has an order to honour.
  const { service, applied } = billingService({
    subscription: {
      ...ACTIVE_SUBSCRIPTION,
      cancelRequestedAt: NOW,
      graceEndsAt: new Date('2026-10-08T12:00:00Z'),
    },
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'order-1',
    payment_id: 'late-charge',
  });
  await service.handleCallback(data, signature, NOW);
  assert.deepEqual(applied[0].update.cancelRequestedAt, NOW);
  assert.equal(applied[0].abandonOpenCheckouts, false);
});

test('sandbox payment statuses never activate a live merchant subscription', async () => {
  const { service, applied } = billingService({ subscription: ACTIVE_SUBSCRIPTION });
  const { data, signature } = signedCallback({
    status: ' SANDBOX ',
    order_id: 'order-1',
    payment_id: 'sandbox-event',
  });
  await service.handleCallback(data, signature, NOW);
  assert.equal(applied[0].issue, 'unexpected-sandbox');
  assert.equal(applied[0].credited, false);
  assert.equal(applied[0].update, null);
});

test('sandbox acceptance requires explicit sandbox mode and a sandbox key pair', () => {
  assert.equal(liqPay().isSandbox(), false);
  assert.equal(liqPay({ LIQPAY_MODE: 'sandbox' }).isSandbox(), false);
  assert.equal(
    liqPay({
      LIQPAY_MODE: 'sandbox',
      LIQPAY_PUBLIC_KEY: 'sandbox_public',
      LIQPAY_PRIVATE_KEY: 'sandbox_private',
    }).isSandbox(),
    true,
  );
  assert.equal(
    liqPay({
      LIQPAY_MODE: 'live',
      LIQPAY_PUBLIC_KEY: 'sandbox_public',
      LIQPAY_PRIVATE_KEY: 'sandbox_private',
    }).isSandbox(),
    false,
  );
});

test('unsubscribe confirmations without a charge id are still recorded for queue resolution', async () => {
  const { service, applied, notified } = billingService({
    subscription: { ...ACTIVE_SUBSCRIPTION, cancelRequestedAt: NOW },
  });
  const { data, signature } = signedCallback({ status: 'unsubscribed', order_id: 'order-1' });
  await service.handleCallback(data, signature, NOW);
  assert.equal(applied[0].paymentId, 'unsubscribe');
  assert.equal(applied[0].status, 'unsubscribed');
  assert.equal(applied[0].update, null);
  assert.equal(notified[0].titleKey, 'subscriptionCancellationConfirmed');
});

test('a charge landing inside the paid period extends it rather than starting it over', () => {
  // Replacing a card is a fresh checkout against a subscription that is still paid up. Starting
  // the month from `now` charged for a month and silently dropped what was left of the old one.
  const next = transitionForCallbackStatus({
    current: {
      status: 'ACTIVE',
      graceEndsAt: null,
      currentPeriodEndsAt: new Date('2026-10-01T00:00:00.000Z'),
      cancelRequestedAt: null,
    },
    callbackStatus: 'success',
    now: new Date('2026-09-09T12:00:00.000Z'),
    isNewSubscription: true,
  });

  assert.equal(next.currentPeriodEndsAt.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(next.status, 'ACTIVE');
  assert.equal(next.cancelRequestedAt, null);
});

test('a renewal after the period ran out still starts its month from the payment', () => {
  const next = transitionForCallbackStatus({
    current: {
      status: 'ACTIVE',
      graceEndsAt: null,
      currentPeriodEndsAt: new Date('2026-08-25T00:00:00.000Z'),
      cancelRequestedAt: null,
    },
    callbackStatus: 'success',
    now: NOW,
    isNewSubscription: false,
  });

  assert.equal(next.currentPeriodEndsAt.toISOString(), '2026-10-01T12:00:00.000Z');
});

test('a callback is out of order when its event predates one already applied', () => {
  const earlier = new Date('2026-09-01T10:00:00.000Z');
  const later = new Date('2026-09-01T11:00:00.000Z');

  assert.equal(
    isOutOfOrderCallback({
      outcome: 'failed',
      eventAt: earlier,
      lastEventAt: later,
      paymentAlreadyFailed: false,
    }),
    true,
  );
  // Equal stamps are two reports of the same moment, and neither supersedes the other.
  assert.equal(
    isOutOfOrderCallback({
      outcome: 'failed',
      eventAt: later,
      lastEventAt: later,
      paymentAlreadyFailed: false,
    }),
    false,
  );
  // Nothing to compare against: the first callback of a subscription, or one LiqPay sent with no
  // timestamp at all, has to be acted on.
  assert.equal(
    isOutOfOrderCallback({
      outcome: 'failed',
      eventAt: null,
      lastEventAt: later,
      paymentAlreadyFailed: false,
    }),
    false,
  );
});

test('a success for a payment already recorded as failed is out of order without any timestamp', () => {
  assert.equal(
    isOutOfOrderCallback({
      outcome: 'paid',
      eventAt: null,
      lastEventAt: null,
      paymentAlreadyFailed: true,
    }),
    true,
  );
  // A failure repeated after a failure is not out of order - it is the same news twice, and the
  // state machine already refuses to extend a grace period over it.
  assert.equal(
    isOutOfOrderCallback({
      outcome: 'failed',
      eventAt: null,
      lastEventAt: null,
      paymentAlreadyFailed: true,
    }),
    false,
  );
});

test('a failure delivered late does not take back a renewal already credited', async () => {
  // The scenario the callback log now protects against: LiqPay retries an old failed charge after
  // a newer one succeeded, and PAST_DUE would be applied on top of a subscription that has paid.
  const { service, applied, notified } = billingService({
    subscription: ACTIVE_SUBSCRIPTION,
    lastEventAt: new Date('2026-09-01T11:00:00.000Z'),
  });
  const { data, signature } = signedCallback({
    status: 'failure',
    order_id: 'order-1',
    payment_id: 7,
    end_date: Date.parse('2026-09-01T10:00:00.000Z'),
  });

  assert.deepEqual(await service.handleCallback(data, signature), { ok: true });
  // Recorded, because the log is the audit trail - but with nothing to write to the subscription.
  assert.equal(applied.length, 1);
  assert.equal(applied[0].update, null);
  assert.equal(applied[0].nextStatus, null);
  assert.equal(applied[0].issue, 'out-of-order-callback');
  assert.equal(applied[0].eventAt.toISOString(), '2026-09-01T10:00:00.000Z');
  assert.deepEqual(notified, []);
});

test('a success redelivered after the same payment was reversed credits nothing', async () => {
  const { service, applied } = billingService({
    subscription: ACTIVE_SUBSCRIPTION,
    paymentAlreadyFailed: true,
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'order-1',
    payment_id: 7,
  });

  assert.deepEqual(await service.handleCallback(data, signature), { ok: true });
  assert.equal(applied[0].update, null);
  assert.equal(applied[0].credited, false);
  assert.equal(applied[0].issue, 'out-of-order-callback');
});

test('a callback carrying its event time records it for the next one to be judged against', async () => {
  const { service, applied } = billingService({ subscription: ACTIVE_SUBSCRIPTION });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'order-1',
    payment_id: 8,
    create_date: Date.parse('2026-09-01T09:00:00.000Z'),
  });

  await service.handleCallback(data, signature);

  assert.equal(applied[0].eventAt.toISOString(), '2026-09-01T09:00:00.000Z');
  assert.equal(applied[0].credited, true);
});

test('LiqPay status answers are read back into the same shape a callback carries', async () => {
  const service = liqPay();
  const body = JSON.stringify({
    status: 'success',
    payment_id: 99,
    amount: 190,
    currency: 'UAH',
    sender_card_mask2: '424242******4242',
    end_date: Date.parse('2026-09-01T10:00:00.000Z'),
  });

  const status = await withFetch(liqPayResponse(body), () => service.queryOrderStatus('order-1'));

  assert.equal(status.status, 'success');
  assert.equal(status.paymentId, '99');
  assert.equal(status.amountMinor, 19000);
  assert.equal(status.cardMask, '424242******4242');
  assert.equal(status.eventAt.toISOString(), '2026-09-01T10:00:00.000Z');
});

test('a status LiqPay will not answer is null, never a payment we treat as failed', async () => {
  const service = liqPay();

  assert.equal(
    await withFetch(liqPayResponse('', { ok: false, status: 502 }), () =>
      service.queryOrderStatus('order-1'),
    ),
    null,
  );
  assert.equal(
    await withFetch(liqPayResponse('not json'), () => service.queryOrderStatus('order-1')),
    null,
  );
});

test('an order LiqPay reports as paid is credited through the ordinary callback path', async () => {
  // A renewal whose callback never arrived. Nothing else can tell that apart from a payment that
  // failed, and the difference is an organization that has paid being told it has not.
  const { service, applied } = billingService({
    subscription: { ...ACTIVE_SUBSCRIPTION, currentPeriodEndsAt: new Date('2026-08-25T00:00:00Z') },
  });
  service.liqPayService.queryOrderStatus = async () => ({
    status: 'success',
    paymentId: '99',
    amountMinor: 19000,
    currency: 'UAH',
    cardMask: null,
    cardBrand: null,
    eventAt: new Date('2026-08-30T00:00:00.000Z'),
  });

  assert.equal(await service.reconcileOrderWithProvider('order-1', NOW), true);
  assert.equal(applied[0].paymentId, '99');
  assert.equal(applied[0].credited, true);
  assert.equal(applied[0].nextStatus, 'ACTIVE');
  // The payload says where this came from, so a row settled from a poll is never mistaken for a
  // callback LiqPay actually delivered.
  assert.equal(applied[0].payload.source, 'liqpay-status');
});

test('an order LiqPay does not report as paid leaves the subscription untouched', async () => {
  for (const answer of [null, { status: 'failure', paymentId: '99' }, { status: 'success' }]) {
    const { service, applied } = billingService({ subscription: ACTIVE_SUBSCRIPTION });
    service.liqPayService.queryOrderStatus = async () => answer;

    assert.equal(await service.reconcileOrderWithProvider('order-1', NOW), false);
    assert.deepEqual(applied, []);
  }
});
