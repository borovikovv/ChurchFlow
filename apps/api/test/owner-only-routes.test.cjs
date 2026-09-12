require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { Reflector } = require('@nestjs/core');
const { BudgetsController } = require('../dist/modules/budgets/budgets.controller.js');
const { MembershipsController } = require('../dist/modules/memberships/memberships.controller.js');
const { PagesController } = require('../dist/modules/pages/pages.controller.js');
const { WebsitesController } = require('../dist/modules/websites/websites.controller.js');

const OWNER_KEY = 'organizationOwner';
const reflector = new Reflector();

function routeHandlers(controller) {
  return Object.getOwnPropertyNames(controller.prototype)
    .filter((name) => name !== 'constructor')
    .filter((name) => Reflect.hasMetadata('path', controller.prototype[name]));
}

function requiresOwner(controller, handler) {
  return (
    reflector.getAllAndOverride(OWNER_KEY, [controller.prototype[handler], controller]) === true
  );
}

function assertCoverage(controller, name, exemptHandlers) {
  const handlers = routeHandlers(controller);
  assert.ok(handlers.length > 0, `${name} exposes no route handlers`);

  for (const handler of handlers) {
    const expected = !exemptHandlers.includes(handler);
    assert.equal(
      requiresOwner(controller, handler),
      expected,
      `${name}.${handler} owner requirement should be ${expected}`,
    );
  }

  for (const handler of exemptHandlers) {
    assert.ok(handlers.includes(handler), `${name}.${handler} is no longer a route handler`);
  }
}

test('every budget route is owner-only', () => {
  assertCoverage(BudgetsController, 'BudgetsController', []);
});

test('website and page dashboard routes are owner-only, public ones are not', () => {
  assertCoverage(WebsitesController, 'WebsitesController', ['publicWebsite']);
  assertCoverage(PagesController, 'PagesController', ['publicPage', 'publicPagesForSitemap']);
});

test('only the role change is owner-only among membership routes', () => {
  const handlers = routeHandlers(MembershipsController);

  assert.ok(requiresOwner(MembershipsController, 'updateRole'));
  for (const handler of handlers.filter((name) => name !== 'updateRole')) {
    assert.equal(
      requiresOwner(MembershipsController, handler),
      false,
      `MembershipsController.${handler} must stay reachable for admins`,
    );
  }
});
