const assert = require('node:assert/strict');
const test = require('node:test');
const {
  OrganizationsRepository,
} = require('../dist/modules/organizations/repositories/organizations.repository');
const { OrganizationsService } = require('../dist/modules/organizations/organizations.service');

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const PERIOD_ENDS_AT = new Date('2026-10-01T00:00:00Z');

function statusTransaction({
  liqpayOrderId = 'live-order',
  status = 'ACTIVE',
  cancelRequestedAt = null,
  hasSubscription = true,
} = {}) {
  const queued = [];
  const closedCheckouts = [];
  const subscriptionUpdates = [];
  const organizationUpdates = [];
  const subscription = hasSubscription
    ? {
        id: 'subscription',
        status,
        liqpayOrderId,
        cancelRequestedAt,
        graceEndsAt: null,
        currentPeriodEndsAt: PERIOD_ENDS_AT,
      }
    : null;

  const tx = {
    organization: {
      update: async (args) => {
        organizationUpdates.push(args);
        return { id: ORGANIZATION_ID, status: args.data.status };
      },
    },
    subscription: {
      findUnique: async () => subscription,
      update: async (args) => {
        subscriptionUpdates.push(args);
        return { ...subscription, ...args.data };
      },
    },
    billingUnsubscribeRequest: {
      upsert: async (args) => {
        queued.push(args.create.orderId);
        return args.create;
      },
    },
    billingCheckoutOrder: {
      updateMany: async (args) => {
        closedCheckouts.push(args.where);
        return { count: 0 };
      },
    },
  };

  return {
    repository: new OrganizationsRepository({
      $transaction: async (callback) => callback(tx),
    }),
    queued,
    closedCheckouts,
    subscriptionUpdates,
    organizationUpdates,
  };
}

for (const action of ['ARCHIVE', 'SUSPEND', 'DELETE']) {
  test(`${action} stops the subscription that was paying for the organization`, async () => {
    // Every one of these takes the organization out of ACTIVE, which is what the access guard
    // requires - so nobody, platform admins included, could reach billing to stop the card
    // afterwards. The card would have gone on paying for an organization nobody can open.
    const { repository, queued, closedCheckouts, subscriptionUpdates } = statusTransaction();

    const result = await repository.changeStatus(ORGANIZATION_ID, action);

    assert.equal(result.stoppedOrderId, 'live-order');
    assert.deepEqual(queued, ['live-order']);
    assert.equal(closedCheckouts[0].status, 'PROPOSED');
    assert.equal(subscriptionUpdates.length, 1);
  });
}

test('restoring an organization stops nothing and reopens nothing', async () => {
  // A cancelled LiqPay order cannot be revived on the organization's behalf; the owner
  // subscribes again. What restore must not do is touch billing on the way through.
  const { repository, queued, closedCheckouts, subscriptionUpdates, organizationUpdates } =
    statusTransaction();

  const result = await repository.changeStatus(ORGANIZATION_ID, 'RESTORE');

  assert.equal(result.stoppedOrderId, null);
  assert.equal(result.organization.status, 'ACTIVE');
  assert.deepEqual(queued, []);
  assert.deepEqual(closedCheckouts, []);
  assert.deepEqual(subscriptionUpdates, []);
  assert.equal(organizationUpdates.length, 1);
});

test('archiving keeps access that has already been paid for', async () => {
  const { repository, subscriptionUpdates } = statusTransaction();

  await repository.changeStatus(ORGANIZATION_ID, 'ARCHIVE');

  // Cancelling renewal is not the same as cutting the month short: the paid period stands, and
  // recording the cancellation is what keeps a renewal callback still in flight from extending it.
  const { data } = subscriptionUpdates[0];
  assert.ok(data.cancelRequestedAt instanceof Date);
  assert.equal(data.currentPeriodEndsAt, PERIOD_ENDS_AT);
  assert.equal(data.status, 'ACTIVE');
});

test('an organization whose subscription is already cancelled queues nothing to stop', async () => {
  const { repository, queued, closedCheckouts, subscriptionUpdates } = statusTransaction({
    status: 'CANCELED',
    liqpayOrderId: 'old-order',
  });

  const result = await repository.changeStatus(ORGANIZATION_ID, 'DELETE');

  assert.equal(result.stoppedOrderId, null);
  assert.deepEqual(queued, []);
  assert.deepEqual(subscriptionUpdates, []);
  // A checkout still open is payable whatever the subscription says, so it is closed regardless.
  assert.equal(closedCheckouts.length, 1);
});

test('an organization that never subscribed archives without touching billing', async () => {
  const { repository, queued, closedCheckouts } = statusTransaction({ hasSubscription: false });

  const result = await repository.changeStatus(ORGANIZATION_ID, 'ARCHIVE');

  assert.equal(result.stoppedOrderId, null);
  assert.deepEqual(queued, []);
  assert.deepEqual(closedCheckouts, []);
});

function lifecycleService(stoppedOrderId) {
  const auditRows = [];
  const stopped = [];

  return {
    service: new OrganizationsService(
      {
        changeStatus: async () => ({
          organization: { id: ORGANIZATION_ID, status: 'ARCHIVED' },
          stoppedOrderId,
        }),
      },
      {},
      {
        record: async (row) => {
          auditRows.push(row);
        },
      },
      {},
      {
        stopOrder: async (orderId) => {
          stopped.push(orderId);
          return true;
        },
      },
    ),
    auditRows,
    stopped,
  };
}

test('a queued cancellation is sent to LiqPay without waiting for the nightly job', async () => {
  const { service, auditRows, stopped } = lifecycleService('live-order');

  await service.archive(ORGANIZATION_ID, 'platform-admin');

  assert.deepEqual(stopped, ['live-order']);
  // Whoever restores the organization has to know its subscription is gone rather than dormant.
  assert.equal(auditRows[0].metadata.stoppedOrderId, 'live-order');
});

test('an organization with nothing to stop asks LiqPay for nothing', async () => {
  const { service, auditRows, stopped } = lifecycleService(null);

  await service.archive(ORGANIZATION_ID, 'platform-admin');

  assert.deepEqual(stopped, []);
  assert.deepEqual(auditRows[0].metadata, { status: 'ARCHIVED' });
});
