const assert = require('node:assert/strict');
const test = require('node:test');
const { PagesRepository } = require('../dist/modules/pages/repositories/pages.repository');

const ORGANIZATION_ID = 'organization-a';
const OTHER_ORGANIZATION_ID = 'organization-b';
const WEBSITE_ID = 'website';
const PAGE_ID = 'page';

const PAGE_INPUT = { slug: 'about', title: 'About', status: 'DRAFT', seo: {} };
const SECTION_INPUT = { type: 'hero', order: 0, content: { heading: 'Welcome' } };

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (value !== null && typeof value === 'object') {
      return Array.isArray(value.in) ? value.in.includes(row[key]) : true;
    }
    return row[key] === value;
  });
}

function findFirst(rows) {
  return async ({ where }) => rows.find((row) => matches(row, where)) ?? null;
}

function pagesPrisma(options = {}) {
  const {
    websiteOrganizationId = ORGANIZATION_ID,
    pageOrganizationId = ORGANIZATION_ID,
    sectionRows = [
      { id: 'section-1', organizationId: ORGANIZATION_ID, pageId: PAGE_ID, deletedAt: null, order: 0 },
      { id: 'section-2', organizationId: ORGANIZATION_ID, pageId: PAGE_ID, deletedAt: null, order: 1 },
    ],
  } = options;

  const writes = [];
  const write = (operation, result) => async (args) => {
    writes.push({ operation, args });
    return typeof result === 'function' ? result(args) : result;
  };

  const client = {
    organizationWebsite: {
      findUnique: findFirst([{ id: WEBSITE_ID, organizationId: websiteOrganizationId }]),
    },
    websitePage: {
      findFirst: findFirst([
        { id: PAGE_ID, organizationId: pageOrganizationId, deletedAt: null },
      ]),
      create: write('websitePage.create', { id: PAGE_ID, sections: [] }),
      update: write('websitePage.update', { id: PAGE_ID, sections: [] }),
    },
    websiteSection: {
      create: write('websiteSection.create', (args) => ({ id: 'section-new', ...args.data })),
      update: write('websiteSection.update', (args) => ({ id: args.where.id })),
      findMany: async ({ where }) => sectionRows.filter((row) => matches(row, where)),
    },
  };
  client.$transaction = async (callback) => callback(client);

  return { prisma: client, writes };
}

test('page creation stamps the organization and the website it belongs to', async () => {
  const { prisma, writes } = pagesPrisma();
  const repository = new PagesRepository(prisma);

  await repository.createPage(ORGANIZATION_ID, PAGE_INPUT);

  const create = writes.find((entry) => entry.operation === 'websitePage.create');
  assert.ok(create);
  assert.equal(create.args.data.organizationId, ORGANIZATION_ID);
  assert.equal(create.args.data.websiteId, WEBSITE_ID);
  assert.equal(create.args.data.publishedAt, null);
});

test('page creation refuses an organization that has no website', async () => {
  const { prisma, writes } = pagesPrisma({ websiteOrganizationId: OTHER_ORGANIZATION_ID });
  const repository = new PagesRepository(prisma);

  await assert.rejects(repository.createPage(ORGANIZATION_ID, PAGE_INPUT), /WEBSITE_NOT_FOUND/);
  assert.deepEqual(writes, []);
});

test('page update scopes the write by organization and skips soft deleted rows', async () => {
  const { prisma, writes } = pagesPrisma();
  const repository = new PagesRepository(prisma);

  await repository.updatePage(ORGANIZATION_ID, PAGE_ID, PAGE_INPUT);

  const update = writes.find((entry) => entry.operation === 'websitePage.update');
  assert.ok(update);
  assert.deepEqual(update.args.where, {
    id: PAGE_ID,
    organizationId: ORGANIZATION_ID,
    deletedAt: null,
  });
});

test('publishing a page stamps published at and unpublishing clears it', async () => {
  const { prisma, writes } = pagesPrisma();
  const repository = new PagesRepository(prisma);

  await repository.setPagePublished(ORGANIZATION_ID, PAGE_ID, true);
  await repository.setPagePublished(ORGANIZATION_ID, PAGE_ID, false);

  const [published, unpublished] = writes.filter(
    (entry) => entry.operation === 'websitePage.update',
  );
  assert.equal(published.args.data.status, 'PUBLISHED');
  assert.ok(published.args.data.publishedAt instanceof Date);
  assert.equal(unpublished.args.data.status, 'DRAFT');
  assert.equal(unpublished.args.data.publishedAt, null);
});

test('section creation stamps the organization of the page it is added to', async () => {
  const { prisma, writes } = pagesPrisma();
  const repository = new PagesRepository(prisma);

  await repository.createSection(ORGANIZATION_ID, PAGE_ID, SECTION_INPUT);

  const create = writes.find((entry) => entry.operation === 'websiteSection.create');
  assert.ok(create);
  assert.equal(create.args.data.organizationId, ORGANIZATION_ID);
  assert.equal(create.args.data.pageId, PAGE_ID);
});

test('section creation refuses a page owned by another organization', async () => {
  const { prisma, writes } = pagesPrisma({ pageOrganizationId: OTHER_ORGANIZATION_ID });
  const repository = new PagesRepository(prisma);

  await assert.rejects(
    repository.createSection(ORGANIZATION_ID, PAGE_ID, SECTION_INPUT),
    /PAGE_NOT_FOUND/,
  );
  assert.deepEqual(writes, []);
});

test('section delete is a soft delete scoped by organization', async () => {
  const { prisma, writes } = pagesPrisma();
  const repository = new PagesRepository(prisma);

  await repository.deleteSection(ORGANIZATION_ID, 'section-1');

  const update = writes.find((entry) => entry.operation === 'websiteSection.update');
  assert.ok(update);
  assert.deepEqual(update.args.where, {
    id: 'section-1',
    organizationId: ORGANIZATION_ID,
    deletedAt: null,
  });
  assert.ok(update.args.data.deletedAt instanceof Date);
});

test('reordering assigns the order from the position in the submitted list', async () => {
  const { prisma, writes } = pagesPrisma();
  const repository = new PagesRepository(prisma);

  await repository.reorderSections(ORGANIZATION_ID, PAGE_ID, ['section-2', 'section-1']);

  const updates = writes
    .filter((entry) => entry.operation === 'websiteSection.update')
    .map((entry) => [entry.args.where.id, entry.args.data.order]);
  assert.deepEqual(updates.sort(), [
    ['section-1', 1],
    ['section-2', 0],
  ]);
});

test('reordering refuses sections that do not belong to the page', async () => {
  const { prisma, writes } = pagesPrisma({
    sectionRows: [
      { id: 'section-1', organizationId: ORGANIZATION_ID, pageId: PAGE_ID, deletedAt: null, order: 0 },
      { id: 'section-foreign', organizationId: OTHER_ORGANIZATION_ID, pageId: PAGE_ID, deletedAt: null, order: 0 },
    ],
  });
  const repository = new PagesRepository(prisma);

  await assert.rejects(
    repository.reorderSections(ORGANIZATION_ID, PAGE_ID, ['section-1', 'section-foreign']),
    /SECTION_NOT_FOUND/,
  );
  assert.deepEqual(writes, []);
});

test('reordering refuses a duplicated section id instead of writing it twice', async () => {
  const { prisma, writes } = pagesPrisma();
  const repository = new PagesRepository(prisma);

  await assert.rejects(
    repository.reorderSections(ORGANIZATION_ID, PAGE_ID, ['section-1', 'section-1']),
    /SECTION_NOT_FOUND/,
  );
  assert.deepEqual(writes, []);
});
