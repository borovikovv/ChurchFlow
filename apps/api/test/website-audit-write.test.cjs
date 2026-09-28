const assert = require('node:assert/strict');
const test = require('node:test');
const { PagesRepository } = require('../dist/modules/pages/repositories/pages.repository.js');
const {
  WebsitesRepository,
} = require('../dist/modules/websites/repositories/websites.repository.js');

const ORGANIZATION_ID = 'organization';
const ACTOR_USER_ID = 'actor';
const WEBSITE_ID = 'website';
const PAGE_ID = 'page';
const SECTION_ID = 'section';

function auditingTransaction() {
  const auditRows = [];
  const website = {
    id: WEBSITE_ID,
    organizationId: ORGANIZATION_ID,
    title: 'Grace',
    description: null,
    theme: { background: '#ffffff', accent: '#123456' },
    settings: { template: 'city', seo: { noindex: false, title: 'Grace' } },
    organization: { name: 'Grace', slug: 'grace' },
  };
  const page = { id: PAGE_ID, organizationId: ORGANIZATION_ID, slug: 'about', title: 'About' };
  const tx = {
    organizationWebsite: {
      findUnique: async () => website,
      update: async ({ data }) => ({ ...website, ...data }),
    },
    websitePage: {
      create: async ({ data }) => ({ ...page, ...data, sections: [] }),
      update: async ({ data }) => ({ ...page, ...data, sections: [] }),
    },
    websiteSection: {
      update: async () => ({ id: SECTION_ID, type: 'hero', pageId: PAGE_ID }),
    },
    auditLog: {
      create: async ({ data }) => {
        auditRows.push(data);
        return data;
      },
    },
  };

  return { prisma: { $transaction: async (callback) => callback(tx) }, auditRows };
}

function singleAuditRow(auditRows) {
  assert.equal(auditRows.length, 1);
  const [row] = auditRows;
  assert.equal(row.organizationId, ORGANIZATION_ID);
  assert.equal(row.actorUserId, ACTOR_USER_ID);
  return row;
}

test('publishing and unpublishing the website record PUBLISH and UNPUBLISH entries', async () => {
  for (const [published, action] of [
    [true, 'PUBLISH'],
    [false, 'UNPUBLISH'],
  ]) {
    const { prisma, auditRows } = auditingTransaction();
    const repository = new WebsitesRepository(prisma);

    await repository.setPublished({
      organizationId: ORGANIZATION_ID,
      actorUserId: ACTOR_USER_ID,
      published,
    });

    const row = singleAuditRow(auditRows);
    assert.equal(row.action, action);
    assert.equal(row.entityType, 'OrganizationWebsite');
    assert.equal(row.entityId, WEBSITE_ID);
  }
});

test('updating website settings records only the top-level keys that changed', async () => {
  const { prisma, auditRows } = auditingTransaction();
  const repository = new WebsitesRepository(prisma);

  await repository.updateSettings({
    organizationId: ORGANIZATION_ID,
    actorUserId: ACTOR_USER_ID,
    settings: {
      title: 'Grace Church',
      // Same values as stored, in another key order: jsonb reorders keys, so order is not a change.
      theme: { accent: '#123456', background: '#ffffff' },
      settings: { seo: { title: 'Grace', noindex: false, ogImageAssetId: 'asset' } },
    },
  });

  const row = singleAuditRow(auditRows);
  assert.equal(row.action, 'UPDATE');
  assert.equal(row.entityType, 'OrganizationWebsite');
  assert.equal(row.entityId, WEBSITE_ID);
  assert.deepEqual(row.metadata, { changedKeys: ['title', 'settings.seo'] });
});

test('creating a page records a CREATE entry naming the page', async () => {
  const { prisma, auditRows } = auditingTransaction();
  const repository = new PagesRepository(prisma);

  await repository.createPage(ORGANIZATION_ID, ACTOR_USER_ID, {
    slug: 'about',
    title: 'About',
    status: 'DRAFT',
    seo: {},
  });

  const row = singleAuditRow(auditRows);
  assert.equal(row.action, 'CREATE');
  assert.equal(row.entityType, 'WebsitePage');
  assert.equal(row.entityId, PAGE_ID);
  assert.deepEqual(row.metadata, { slug: 'about', title: 'About' });
});

test('updating a page records an UPDATE entry with its slug, title and status', async () => {
  const { prisma, auditRows } = auditingTransaction();
  const repository = new PagesRepository(prisma);

  await repository.updatePage(ORGANIZATION_ID, ACTOR_USER_ID, PAGE_ID, {
    slug: 'about-us',
    title: 'About us',
    status: 'PUBLISHED',
    seo: {},
  });

  const row = singleAuditRow(auditRows);
  assert.equal(row.action, 'UPDATE');
  assert.equal(row.entityType, 'WebsitePage');
  assert.equal(row.entityId, PAGE_ID);
  assert.deepEqual(row.metadata, { slug: 'about-us', title: 'About us', status: 'PUBLISHED' });
});

test('publishing and unpublishing a page record PUBLISH and UNPUBLISH entries', async () => {
  for (const [published, action] of [
    [true, 'PUBLISH'],
    [false, 'UNPUBLISH'],
  ]) {
    const { prisma, auditRows } = auditingTransaction();
    const repository = new PagesRepository(prisma);

    await repository.setPagePublished(ORGANIZATION_ID, ACTOR_USER_ID, PAGE_ID, published);

    const row = singleAuditRow(auditRows);
    assert.equal(row.action, action);
    assert.equal(row.entityType, 'WebsitePage');
    assert.equal(row.entityId, PAGE_ID);
    assert.deepEqual(row.metadata, { slug: 'about', title: 'About' });
  }
});

test('deleting a section records a DELETE entry with its type and page', async () => {
  const { prisma, auditRows } = auditingTransaction();
  const repository = new PagesRepository(prisma);

  const result = await repository.deleteSection(ORGANIZATION_ID, ACTOR_USER_ID, SECTION_ID);

  assert.deepEqual(result, { id: SECTION_ID });
  const row = singleAuditRow(auditRows);
  assert.equal(row.action, 'DELETE');
  assert.equal(row.entityType, 'WebsiteSection');
  assert.equal(row.entityId, SECTION_ID);
  assert.deepEqual(row.metadata, { type: 'hero', pageId: PAGE_ID });
});
