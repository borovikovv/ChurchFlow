const assert = require('node:assert/strict');
const test = require('node:test');
const {
  OrganizationsRepository,
} = require('../dist/modules/organizations/repositories/organizations.repository');
const { OrganizationsService } = require('../dist/modules/organizations/organizations.service');
const { MediaRepository } = require('../dist/modules/media/repositories/media.repository');
const { MediaService } = require('../dist/modules/media/media.service');

const ORGANIZATION_ID = 'organization';
const ACTOR_USER_ID = 'actor';
const CURRENT = { name: 'Grace Church', slug: 'grace', description: 'A church' };

function repository(current = CURRENT) {
  const calls = [];
  const tx = {
    organization: {
      findFirst: async () => current,
      update: async ({ data }) => {
        calls.push({ model: 'organization.update', data });
        return { id: ORGANIZATION_ID, ...current, ...data };
      },
      findUniqueOrThrow: async () => ({ id: ORGANIZATION_ID, ...current }),
    },
    websitePage: {
      updateMany: async (args) => {
        calls.push({ model: 'websitePage.updateMany', args });
        return { count: 1 };
      },
    },
    organizationWebsite: {
      upsert: async (args) => {
        calls.push({ model: 'organizationWebsite.upsert', args });
        return {};
      },
    },
    auditLog: {
      create: async (args) => {
        calls.push({ model: 'auditLog.create', args });
        return {};
      },
    },
  };

  return {
    repository: new OrganizationsRepository({ $transaction: async (run) => run(tx) }),
    calls,
  };
}

test('renaming an organization no longer rewrites its website', async () => {
  // The site title, its description and the home page title are edited on the website settings
  // screen. Propagating a profile rename into them changed published content nobody was editing.
  const { repository: organizations, calls } = repository();

  await organizations.update(
    ORGANIZATION_ID,
    { name: 'Grace Community', description: 'Renamed' },
    ACTOR_USER_ID,
    'ADMIN',
  );

  assert.deepEqual(
    calls.map((call) => call.model),
    ['organization.update', 'auditLog.create'],
  );
});

test('an admin resubmitting the unchanged slug is not refused', async () => {
  // The edit form always submits the slug, changed or not, so the rule has to compare values
  // rather than the presence of the field.
  const { repository: organizations, calls } = repository();

  await organizations.update(
    ORGANIZATION_ID,
    { name: 'Grace Community', slug: 'grace' },
    ACTOR_USER_ID,
    'ADMIN',
  );

  assert.equal(calls[0].data.name, 'Grace Community');
  assert.equal('slug' in calls[0].data, false);
});

test('an admin moving the public address is refused', async () => {
  // The slug is the public site URL: every link already handed out 404s after it moves.
  const { repository: organizations, calls } = repository();

  await assert.rejects(
    organizations.update(ORGANIZATION_ID, { slug: 'grace-community' }, ACTOR_USER_ID, 'ADMIN'),
    /SLUG_OWNER_ONLY/,
  );
  assert.deepEqual(calls, []);
});

test('an owner moving the public address is allowed', async () => {
  const { repository: organizations, calls } = repository();

  await organizations.update(ORGANIZATION_ID, { slug: 'grace-community' }, ACTOR_USER_ID, 'OWNER');

  assert.equal(calls[0].data.slug, 'grace-community');
});

test('the slug rule reaches the caller as a forbidden, not a server error', async () => {
  const passed = [];
  const service = new OrganizationsService(
    {
      findActiveById: async () => ({ id: ORGANIZATION_ID }),
      findOrganizationManager: async () => ({ id: 'membership', role: 'ADMIN' }),
      update: async (...args) => {
        passed.push(args);
        throw new Error('SLUG_OWNER_ONLY');
      },
    },
    {},
    { record: async () => undefined },
    { assert: async () => undefined },
  );

  await assert.rejects(
    service.update(ORGANIZATION_ID, { slug: 'grace-community' }, ACTOR_USER_ID),
    (error) => {
      assert.equal(error.getStatus(), 403);
      return true;
    },
  );

  // The actor's role is what the repository decides on, so it has to travel with the input.
  assert.equal(passed[0][3], 'ADMIN');
});

test('replacing the logo writes the logo and nothing else', async () => {
  // An admin may change the branding, so this write must not double as an edit of the website
  // record: no creating it, no seeding its title or description from the organization.
  const calls = [];
  const tx = {
    organizationWebsite: {
      findUnique: async () => ({ logoAssetId: 'old-asset' }),
      update: async (args) => {
        calls.push({ model: 'organizationWebsite.update', args });
        return {};
      },
      upsert: async () => {
        throw new Error('a logo upload must not create the website record');
      },
    },
    organization: {
      findUniqueOrThrow: async () => {
        throw new Error('a logo upload must not read organization content');
      },
    },
    mediaAsset: {
      update: async (args) => {
        calls.push({ model: 'mediaAsset.update', args });
        return {};
      },
    },
    auditLog: {
      create: async () => ({}),
    },
  };
  const media = new MediaRepository({ $transaction: async (run) => run(tx) });

  await media.attachOrganizationLogo(ORGANIZATION_ID, 'new-asset', ACTOR_USER_ID);

  const websiteWrite = calls.find((call) => call.model === 'organizationWebsite.update');
  assert.deepEqual(websiteWrite.args.data, { logoAssetId: 'new-asset' });

  // The logo it replaces is still retired.
  const retired = calls.find(
    (call) => call.model === 'mediaAsset.update' && call.args.where.id === 'old-asset',
  );
  assert.ok(retired.args.data.deletedAt instanceof Date);
});

test('a website section background is refused to anyone but the owner', async () => {
  const service = new MediaService(
    { findOwnedOrganization: async () => null },
    { getOrThrow: () => 'test' },
  );

  await assert.rejects(
    () =>
      service.createWebsiteSectionBackgroundUpload(
        ORGANIZATION_ID,
        { filename: 'bg.png', mimeType: 'image/png', byteSize: 1024 },
        ACTOR_USER_ID,
      ),
    /Only organization owners can upload website images/,
  );
});

test('a restricted organization cannot change its profile or public slug', async () => {
  const { ForbiddenException } = require('@nestjs/common');
  const { ENTITLEMENTS } = require('@churchflow/shared');
  let writes = 0;
  const service = new OrganizationsService(
    {
      findActiveById: async () => ({ id: ORGANIZATION_ID }),
      findOrganizationManager: async () => ({ id: 'membership', role: 'OWNER' }),
      update: async () => {
        writes++;
      },
    },
    {},
    {},
    {
      assert: async (id, entitlement) => {
        assert.equal(id, ORGANIZATION_ID);
        assert.equal(entitlement, ENTITLEMENTS.websiteWrite);
        throw new ForbiddenException({ code: 'ORGANIZATION_RESTRICTED' });
      },
    },
    {},
  );
  await assert.rejects(
    () => service.update(ORGANIZATION_ID, { slug: 'new-slug', name: 'New name' }, ACTOR_USER_ID),
    (error) => error.getResponse().code === 'ORGANIZATION_RESTRICTED',
  );
  assert.equal(writes, 0);
});
