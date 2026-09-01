const assert = require('node:assert/strict');
const test = require('node:test');
const { LiqPayService } = require('../dist/modules/billing/liqpay.service');
const { BillingService } = require('../dist/modules/billing/billing.service');
const { transitionForCallbackStatus } = require('../dist/modules/billing/subscription-transitions');

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
  });

  assert.equal(next.graceEndsAt.toISOString(), graceEndsAt.toISOString());
});

test('a failure after restriction does not hand write access back', () => {
  const next = transitionForCallbackStatus({
    current: { status: 'RESTRICTED', graceEndsAt: null, currentPeriodEndsAt: null },
    callbackStatus: 'failure',
    now: NOW,
  });

  assert.equal(next, null);
});

test('a reversal is treated as unpaid', () => {
  const next = transitionForCallbackStatus({
    current: { status: 'ACTIVE', graceEndsAt: null, currentPeriodEndsAt: null },
    callbackStatus: 'reversed',
    now: NOW,
  });

  assert.equal(next.status, 'PAST_DUE');
});

test('unsubscribing cancels', () => {
  const next = transitionForCallbackStatus({
    current: { status: 'ACTIVE', graceEndsAt: null, currentPeriodEndsAt: NOW },
    callbackStatus: 'unsubscribed',
    now: NOW,
  });

  assert.equal(next.status, 'CANCELED');
});

test('an undecided status changes nothing', () => {
  for (const status of ['wait_accept', 'wait_secure', '3ds_verify', 'processing', '']) {
    const next = transitionForCallbackStatus({
      current: { status: 'ACTIVE', graceEndsAt: null, currentPeriodEndsAt: null },
      callbackStatus: status,
      now: NOW,
    });

    assert.equal(next, null, status);
  }
});

function billingService({ subscription, duplicate = false } = {}) {
  const applied = [];
  const notified = [];

  const repository = {
    findByOrderId: async () => subscription,
    applyCallback: async (input) => {
      applied.push(input);
      return { duplicate };
    },
    listAdminMembershipIds: async () => [{ id: 'membership' }],
  };

  const service = new BillingService(
    repository,
    { listForOrganization: async () => [] },
    liqPay(),
    { getCurrent: async () => ({ usdToUah: 41.5, eurToUah: 48.2 }) },
    {
      createSubscriptionNotifications: async (input) => {
        notified.push(input);
        return { createdCount: 1 };
      },
    },
  );

  return { service, applied, notified };
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
