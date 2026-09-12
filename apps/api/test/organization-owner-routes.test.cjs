const assert = require('node:assert/strict');
const test = require('node:test');
const { Reflector } = require('@nestjs/core');
const { OrganizationAccessGuard } = require('../dist/common/guards/organization-access.guard');
const { BudgetsController } = require('../dist/modules/budgets/budgets.controller');
const { WebsitesController } = require('../dist/modules/websites/websites.controller');
const { PagesController } = require('../dist/modules/pages/pages.controller');
const { MembershipsController } = require('../dist/modules/memberships/memberships.controller');
const { MediaController } = require('../dist/modules/media/media.controller');

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';

function guard({ role, platformRole = 'USER' }) {
  const prisma = {
    user: {
      findUnique: async () => ({
        platformRole,
        deletedAt: null,
        memberships: role ? [{ role, permissions: [] }] : [],
      }),
    },
    organization: {
      findFirst: async () => ({ id: ORGANIZATION_ID }),
    },
  };

  // The real Reflector, so the test reads the decorators the controllers actually carry rather
  // than a restatement of them.
  return new OrganizationAccessGuard(prisma, new Reflector());
}

function context(controller, handlerName) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        params: { organizationId: ORGANIZATION_ID },
        auth: { userId: 'user' },
      }),
    }),
    getHandler: () => controller.prototype[handlerName],
    getClass: () => controller,
  };
}

const OWNER_ONLY_ROUTES = [
  [BudgetsController, 'list'],
  [BudgetsController, 'createMonth'],
  [WebsitesController, 'dashboardWebsite'],
  [WebsitesController, 'updateSettings'],
  [PagesController, 'dashboardPages'],
  [PagesController, 'createPage'],
  // The assets that feed owner-only sections: an admin could otherwise upload backgrounds they
  // are no longer allowed to attach to anything.
  [MediaController, 'createWebsiteSectionBackgroundUpload'],
  [MediaController, 'confirmWebsiteSectionBackground'],
];

test('the budget and the website are closed to admins', async () => {
  for (const [controller, handler] of OWNER_ONLY_ROUTES) {
    await assert.rejects(
      () => guard({ role: 'ADMIN' }).canActivate(context(controller, handler)),
      (error) => {
        assert.equal(error.getStatus(), 403, `${controller.name}.${handler}`);
        return true;
      },
    );
  }
});

test('an owner reaches every one of them', async () => {
  for (const [controller, handler] of OWNER_ONLY_ROUTES) {
    assert.equal(
      await guard({ role: 'OWNER' }).canActivate(context(controller, handler)),
      true,
      `${controller.name}.${handler}`,
    );
  }
});

test('a plain member is refused as well', async () => {
  // Reads included: these routes carried no permission requirement at all, so any active member
  // could call them directly while only the navigation hid them.
  await assert.rejects(
    () => guard({ role: 'MEMBER' }).canActivate(context(BudgetsController, 'list')),
    (error) => {
      assert.equal(error.getStatus(), 403);
      return true;
    },
  );
});

test('routes that are not owner-only stay open to admins', async () => {
  assert.equal(
    await guard({ role: 'ADMIN' }).canActivate(context(MembershipsController, 'updateProfile')),
    true,
  );
});

test('the organization logo stays an admin action', async () => {
  // The logo is branding, shown in the dashboard as much as on the public site, so it is not
  // website content and does not follow the website into owner-only.
  for (const handler of ['createOrganizationLogoUpload', 'confirmOrganizationLogo']) {
    assert.equal(
      await guard({ role: 'ADMIN' }).canActivate(context(MediaController, handler)),
      true,
      handler,
    );
  }
});

test('a platform admin still gets through, as everywhere else in this guard', async () => {
  // Membership is bypassed for platform admins by design; entitlements are the rule that is not
  // bypassed. Changing that here would break the admin area silently.
  assert.equal(
    await guard({ role: null, platformRole: 'SUPER_ADMIN' }).canActivate(
      context(BudgetsController, 'list'),
    ),
    true,
  );
});
