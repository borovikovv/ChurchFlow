const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ENTITLEMENTS,
  ORGANIZATION_RESTRICTED_ERROR_CODE,
  createOrganizationSchema,
  grantBillingExemptionSchema,
  updateOrganizationSchema,
} = require('@churchflow/shared');
const { EntitlementsService } = require('../dist/modules/billing/entitlements.service');
const {
  SubscriptionEntitlementGuard,
} = require('../dist/common/guards/subscription-entitlement.guard');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const {
  OrganizationsRepository,
} = require('../dist/modules/organizations/repositories/organizations.repository');

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';

function entitlementsService(subscription, { enforcementEnabled = true } = {}) {
  return new EntitlementsService(
    { findEntitlementState: async () => subscription },
    { getOrThrow: () => enforcementEnabled },
  );
}

function guard(subscription, requiredEntitlement, options) {
  return new SubscriptionEntitlementGuard(entitlementsService(subscription, options), {
    getAllAndOverride: () => requiredEntitlement,
  });
}

function context(params = { organizationId: ORGANIZATION_ID }, auth = { userId: 'user' }) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ params, auth }) }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  };
}

function restricted() {
  return { status: 'RESTRICTED', isExempt: false, restrictAfter: null, graceEndsAt: null };
}

function active() {
  return { status: 'ACTIVE', isExempt: false, restrictAfter: null, graceEndsAt: null };
}

test('a route without an entitlement requirement is not touched', async () => {
  const allowed = await guard(restricted(), undefined).canActivate(context());
  assert.equal(allowed, true);
});

test('an entitled organization passes', async () => {
  const allowed = await guard(active(), ENTITLEMENTS.membersWrite).canActivate(context());
  assert.equal(allowed, true);
});

test('a restricted organization is refused with a code the client can branch on', async () => {
  await assert.rejects(
    () => guard(restricted(), ENTITLEMENTS.membersWrite).canActivate(context()),
    (error) => {
      assert.equal(error.getStatus(), 403);
      assert.equal(error.getResponse().code, ORGANIZATION_RESTRICTED_ERROR_CODE);
      assert.match(error.getResponse().message, /complimentary access/);
      return true;
    },
  );
});

test('a restricted organization still allows reads', async () => {
  const allowed = await guard(restricted(), ENTITLEMENTS.membersRead).canActivate(context());
  assert.equal(allowed, true);
});

test('no role bypasses the entitlement check', async () => {
  // OrganizationAccessGuard lets OWNER/ADMIN skip permissions and platform admins skip
  // membership. This guard reads neither, so the same denial holds whoever is asking.
  for (const auth of [
    { userId: 'owner', platformRole: 'SUPER_ADMIN' },
    { userId: 'admin', platformRole: 'ADMIN' },
    { userId: 'member' },
  ]) {
    await assert.rejects(
      () => guard(restricted(), ENTITLEMENTS.calendarWrite).canActivate(context(undefined, auth)),
      (error) => error.getResponse().code === ORGANIZATION_RESTRICTED_ERROR_CODE,
    );
  }
});

test('complimentary access lets a restricted organization write again', async () => {
  const exempt = { ...restricted(), isExempt: true };
  const allowed = await guard(exempt, ENTITLEMENTS.membersWrite).canActivate(context());
  assert.equal(allowed, true);
});

test('the kill switch disables enforcement entirely', async () => {
  const allowed = await guard(restricted(), ENTITLEMENTS.filesUpload, {
    enforcementEnabled: false,
  }).canActivate(context());
  assert.equal(allowed, true);
});

test('an organization with no subscription row cannot write', async () => {
  await assert.rejects(
    () => guard(null, ENTITLEMENTS.budgetWrite).canActivate(context()),
    (error) => error.getResponse().code === ORGANIZATION_RESTRICTED_ERROR_CODE,
  );
});

test('a route with no organization id is a bad request, not a silent pass', async () => {
  await assert.rejects(
    () => guard(restricted(), ENTITLEMENTS.membersWrite).canActivate(context({})),
    (error) => error.getStatus() === 400,
  );
});

test('an array organization id is narrowed to its first value', async () => {
  const allowed = await guard(active(), ENTITLEMENTS.membersWrite).canActivate(
    context({ organizationId: [ORGANIZATION_ID, 'other'] }),
  );
  assert.equal(allowed, true);
});

test('no organization-scoped payload can grant complimentary access to itself', () => {
  // The only path to isExempt is the platform-admin route. Zod strips unknown keys, so a
  // hand-crafted body cannot smuggle it through an organization endpoint.
  const update = updateOrganizationSchema.parse({ name: 'Church', isExempt: true });
  assert.equal('isExempt' in update, false);

  const create = createOrganizationSchema.parse({
    name: 'Church',
    slug: 'church',
    isExempt: true,
    exemptReason: 'nice try',
  });
  assert.equal('isExempt' in create, false);
  assert.equal('exemptReason' in create, false);

  const grant = grantBillingExemptionSchema.parse({ reason: 'Partner church', isExempt: false });
  assert.deepEqual(grant, { reason: 'Partner church' });
});

test('a grant without a reason is rejected', () => {
  assert.throws(() => grantBillingExemptionSchema.parse({}));
  assert.throws(() => grantBillingExemptionSchema.parse({ reason: '   ' }));
});

function exemptionTransaction() {
  const auditRows = [];
  const updates = [];
  const tx = {
    subscription: {
      update: async (args) => {
        updates.push(args);
        return { id: 'subscription', status: 'PAST_DUE' };
      },
    },
    auditLog: {
      create: async (args) => {
        auditRows.push(args.data);
        return args.data;
      },
    },
  };

  return {
    repository: new OrganizationsRepository({
      $transaction: async (callback) => callback(tx),
    }),
    auditRows,
    updates,
  };
}

test('granting complimentary access records who granted it and why', async () => {
  const { repository, auditRows, updates } = exemptionTransaction();

  await repository.setBillingExemption({
    organizationId: ORGANIZATION_ID,
    actorUserId: 'platform-admin',
    reason: 'Partner church',
  });

  assert.equal(updates[0].data.isExempt, true);
  assert.equal(updates[0].data.exemptReason, 'Partner church');
  assert.equal(updates[0].data.exemptGrantedByUserId, 'platform-admin');
  assert.ok(updates[0].data.exemptGrantedAt instanceof Date);

  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].action, 'GRANT_BILLING_EXEMPTION');
  assert.equal(auditRows[0].entityType, 'Subscription');
  assert.equal(auditRows[0].actorUserId, 'platform-admin');
  assert.equal(auditRows[0].metadata.reason, 'Partner church');
});

test('revoking clears the grant and leaves the real subscription status alone', async () => {
  const { repository, auditRows, updates } = exemptionTransaction();

  await repository.setBillingExemption({
    organizationId: ORGANIZATION_ID,
    actorUserId: 'platform-admin',
    reason: null,
  });

  assert.deepEqual(updates[0].data, {
    isExempt: false,
    exemptReason: null,
    exemptGrantedByUserId: null,
    exemptGrantedAt: null,
  });
  // The invariant: revoking must never leave an unpaid organization looking ACTIVE.
  assert.equal('status' in updates[0].data, false);
  assert.equal(auditRows[0].action, 'REVOKE_BILLING_EXEMPTION');
  assert.equal(auditRows[0].metadata.subscriptionStatus, 'PAST_DUE');
});

function capture(error) {
  const response = {
    code: null,
    body: null,
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  new HttpExceptionFilter().catch(error, {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'POST', originalUrl: '/v1/test' }),
    }),
  });

  return response;
}

test('an explicit error code survives the exception filter', async () => {
  let thrown;
  try {
    await guard(restricted(), ENTITLEMENTS.membersWrite).canActivate(context());
  } catch (error) {
    thrown = error;
  }

  const response = capture(thrown);
  assert.equal(response.code, 403);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error.code, ORGANIZATION_RESTRICTED_ERROR_CODE);
  assert.match(response.body.error.message, /subscription/);
});

test('errors without an explicit code still answer REQUEST_FAILED', () => {
  const { ForbiddenException } = require('@nestjs/common');
  const response = capture(new ForbiddenException('Organization permission is required'));

  assert.equal(response.body.error.code, 'REQUEST_FAILED');
  assert.equal(response.body.error.message, 'Organization permission is required');
});

test('server errors are never given a client-supplied code', () => {
  const response = capture(new Error('boom'));

  assert.equal(response.code, 500);
  assert.equal(response.body.error.code, 'INTERNAL_SERVER_ERROR');
  assert.equal(response.body.error.message, 'Unexpected server error');
});
