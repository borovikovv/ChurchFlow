const assert = require('node:assert/strict');
const test = require('node:test');
const { LiqPayService } = require('../dist/modules/billing/liqpay.service');
const { BillingService } = require('../dist/modules/billing/billing.service');
const { transitionForCallbackStatus } = require('../dist/modules/billing/subscription-transitions');
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

test('unsubscribing cancels', () => {
  const next = transitionForCallbackStatus({
    current: { status: 'ACTIVE', graceEndsAt: null, currentPeriodEndsAt: NOW },
    callbackStatus: 'unsubscribed',
    now: NOW,
    isNewSubscription: false,
  });

  assert.equal(next.status, 'CANCELED');
});

test('a stray charge does not revive a cancelled subscription', () => {
  // The organization asked to stop. A payment that lands anyway - one already in flight, or a
  // LiqPay unsubscribe that never took - must not put it back on the hook.
  const next = transitionForCallbackStatus({
    current: { status: 'CANCELED', graceEndsAt: null, currentPeriodEndsAt: NOW },
    callbackStatus: 'success',
    now: NOW,
    isNewSubscription: false,
  });

  assert.equal(next, null);
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

function billingService({ subscription, duplicate = false, unsubscribeOk = true } = {}) {
  const applied = [];
  const notified = [];
  const unsubscribed = [];
  const cleared = [];

  const repository = {
    findByOrderId: async () => subscription,
    applyCallback: async (input) => {
      applied.push(input);
      return { duplicate };
    },
    clearPendingUnsubscribe: async (id) => {
      cleared.push(id);
      return {};
    },
    listAdminMembershipIds: async () => [{ id: 'membership' }],
  };

  const liqPayService = liqPay();
  liqPayService.unsubscribe = async (orderId) => {
    unsubscribed.push(orderId);
    return unsubscribeOk;
  };

  const service = new BillingService(
    repository,
    { listForOrganization: async () => [] },
    liqPayService,
    { getCurrent: async () => ({ usdToUah: 41.5, eurToUah: 48.2 }) },
    {
      createSubscriptionNotifications: async (input) => {
        notified.push(input);
        return { createdCount: 1 };
      },
    },
  );

  return { service, applied, notified, unsubscribed, cleared };
}

function signedCallback(payload) {
  const data = encode(payload);

  return { data, signature: liqPay().sign(data) };
}

const ACTIVE_SUBSCRIPTION = {
  id: 'subscription',
  organizationId: 'organization',
  status: 'ACTIVE',
  graceEndsAt: null,
  currentPeriodEndsAt: null,
  liqpayOrderId: 'order-1',
  pendingLiqpayOrderId: null,
  pendingAmountMinor: null,
  pendingFxRateUsedAt: null,
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
  const fxRateUsedAt = new Date('2026-08-30T00:00:00.000Z');
  const { service, applied, unsubscribed, cleared } = billingService({
    subscription: {
      ...ACTIVE_SUBSCRIPTION,
      liqpayOrderId: 'old-order',
      pendingLiqpayOrderId: 'new-order',
      pendingAmountMinor: 19_000,
      pendingFxRateUsedAt: fxRateUsedAt,
    },
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'new-order',
    payment_id: 55,
  });

  await service.handleCallback(data, signature, NOW);

  const update = applied[0].update;
  assert.equal(update.liqpayOrderId, 'new-order');
  assert.equal(update.pendingLiqpayOrderId, null);
  // The price offered at checkout becomes the live price only now, once it has been paid.
  assert.equal(update.amountMinor, 19_000);
  assert.equal(update.fxRateUsedAt, fxRateUsedAt);
  assert.equal(update.pendingAmountMinor, null);
  assert.equal(update.pendingUnsubscribeOrderId, 'old-order');

  // The old order is stopped only after the swap is committed, never hopefully in advance.
  assert.deepEqual(unsubscribed, ['old-order']);
  assert.deepEqual(cleared, ['subscription']);
});

test('an order LiqPay refuses to stop is kept for the dunning job to retry', async () => {
  const { service, cleared } = billingService({
    subscription: {
      ...ACTIVE_SUBSCRIPTION,
      liqpayOrderId: 'old-order',
      pendingLiqpayOrderId: 'new-order',
      pendingAmountMinor: 19_000,
      pendingFxRateUsedAt: NOW,
    },
    unsubscribeOk: false,
  });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'new-order',
    payment_id: 56,
  });

  await service.handleCallback(data, signature, NOW);

  assert.deepEqual(cleared, []);
});

test('a renewal of the running subscription does not disturb its order ids', async () => {
  const { service, applied } = billingService({ subscription: ACTIVE_SUBSCRIPTION });
  const { data, signature } = signedCallback({
    status: 'success',
    order_id: 'order-1',
    payment_id: 57,
  });

  await service.handleCallback(data, signature, NOW);

  assert.equal('liqpayOrderId' in applied[0].update, false);
  assert.equal('amountMinor' in applied[0].update, false);
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
