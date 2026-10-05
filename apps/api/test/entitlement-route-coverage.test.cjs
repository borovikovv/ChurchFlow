require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { RequestMethod } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const {
  SubscriptionEntitlementGuard,
} = require('../dist/common/guards/subscription-entitlement.guard.js');

const ENTITLEMENT_KEY = 'subscriptionEntitlement';
const GUARDS_KEY = '__guards__';
const WRITE_METHODS = new Set([
  RequestMethod.POST,
  RequestMethod.PUT,
  RequestMethod.PATCH,
  RequestMethod.DELETE,
]);
const reflector = new Reflector();

/**
 * Organization-scoped writes that deliberately carry no route-level entitlement. Each one either
 * changes nothing the subscription pays for, must stay reachable while restricted, or asserts the
 * entitlement in its service after a check the route cannot express.
 */
const EXEMPT_ROUTES = new Set([
  // Billing is how a restricted organization pays its way out.
  'BillingController.startCheckout',
  'BillingController.cancel',
  // The assistant refuses organizations without an active subscription before any tool runs,
  // and each write tool asserts its own entitlement.
  'AiAssistantController.chat',
  // Per-user preferences and inbox state, not organization data.
  'CalendarEventsController.updatePreferences',
  'NotificationsController.updatePreferences',
  'NotificationsController.createTelegramLinkToken',
  'NotificationsController.disconnectTelegram',
  'NotificationsController.markAllRead',
  'NotificationsController.markRead',
  // websiteWrite is asserted in the service, after the role check decides what may change.
  'OrganizationsController.update',
]);

function controllerFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return controllerFiles(entryPath);

    return entry.name.endsWith('.controller.js') ? [entryPath] : [];
  });
}

function loadControllers() {
  return controllerFiles(path.join(__dirname, '../dist/modules')).flatMap((file) =>
    Object.values(require(file)).filter(
      (exported) => typeof exported === 'function' && Reflect.hasMetadata('path', exported),
    ),
  );
}

function organizationWriteRoutes(controller) {
  const controllerPath = String(Reflect.getMetadata('path', controller));

  // Descriptors rather than property reads: some controllers define getters that need an instance.
  return Object.entries(Object.getOwnPropertyDescriptors(controller.prototype))
    .filter(([name]) => name !== 'constructor')
    .map(([name, descriptor]) => ({ name, handler: descriptor.value }))
    .filter(({ handler }) => typeof handler === 'function' && Reflect.hasMetadata('path', handler))
    .filter(({ handler }) => WRITE_METHODS.has(Reflect.getMetadata('method', handler)))
    .filter(({ handler }) =>
      `${controllerPath}/${String(Reflect.getMetadata('path', handler))}`.includes(
        ':organizationId',
      ),
    );
}

function hasEntitlementGuard(controller, handler) {
  return [
    ...(Reflect.getMetadata(GUARDS_KEY, controller) ?? []),
    ...(Reflect.getMetadata(GUARDS_KEY, handler) ?? []),
  ].includes(SubscriptionEntitlementGuard);
}

function requiredEntitlement(controller, handler) {
  return reflector.getAllAndOverride(ENTITLEMENT_KEY, [handler, controller]);
}

const controllers = loadControllers();

test('the sweep finds the organization controllers', () => {
  assert.ok(controllers.length > 10, `only ${controllers.length} controllers were loaded`);
});

test('every organization-scoped write requires a subscription entitlement', () => {
  const uncovered = [];
  for (const controller of controllers) {
    for (const { name, handler } of organizationWriteRoutes(controller)) {
      const route = `${controller.name}.${name}`;
      if (EXEMPT_ROUTES.has(route)) continue;

      if (!hasEntitlementGuard(controller, handler) || !requiredEntitlement(controller, handler)) {
        uncovered.push(route);
      }
    }
  }

  assert.deepEqual(uncovered, []);
});

test('an entitlement is never declared on a route the guard does not run on', () => {
  const inert = [];
  for (const controller of controllers) {
    for (const { name, handler } of organizationWriteRoutes(controller)) {
      if (requiredEntitlement(controller, handler) && !hasEntitlementGuard(controller, handler)) {
        inert.push(`${controller.name}.${name}`);
      }
    }
  }

  assert.deepEqual(inert, []);
});

test('every exemption still names an organization-scoped write route', () => {
  const routes = new Set(
    controllers.flatMap((controller) =>
      organizationWriteRoutes(controller).map(({ name }) => `${controller.name}.${name}`),
    ),
  );

  for (const route of EXEMPT_ROUTES) {
    assert.ok(routes.has(route), `${route} is exempt but is no longer an organization write`);
  }
});
