const assert = require('node:assert/strict');
const test = require('node:test');
const {
  WebsitesRepository,
} = require('../dist/modules/websites/repositories/websites.repository.js');
const { websiteTemplate, websiteTemplateVariantContent } = require('@churchflow/shared');

const ORGANIZATION_ID = 'organization-a';
const ACTOR_USER_ID = 'user-1';
const WEBSITE_ID = 'website';
const PAGE_ID = 'home';

function websitesPrisma(options = {}) {
  const {
    websiteOrganizationId = ORGANIZATION_ID,
    settings = { template: 'default', navigation: [{ label: 'Give', href: '/give' }] },
    theme = { accent: '#123456', background: '#ffffff' },
    homeSections,
  } = options;

  const writes = [];
  const write = (operation, result) => async (args) => {
    writes.push({ operation, args });
    return typeof result === 'function' ? result(args) : result;
  };
  const website = { id: WEBSITE_ID, organizationId: websiteOrganizationId, settings, theme };
  const homePage = homeSections
    ? {
        id: PAGE_ID,
        organizationId: ORGANIZATION_ID,
        websiteId: WEBSITE_ID,
        slug: 'home',
        sections: homeSections,
      }
    : null;

  const client = {
    organizationWebsite: {
      findUnique: async ({ where }) =>
        where.organizationId === website.organizationId ? website : null,
      update: write('organizationWebsite.update', (args) => ({
        ...website,
        ...args.data,
        organization: { name: 'Grace', slug: 'grace' },
      })),
    },
    websitePage: {
      findFirst: async ({ where }) =>
        homePage && where.websiteId === WEBSITE_ID && where.organizationId === ORGANIZATION_ID
          ? homePage
          : null,
      create: write('websitePage.create', (args) => ({ id: 'new-home', ...args.data })),
    },
    websiteSection: {
      create: write('websiteSection.create', (args) => ({ id: 'section-new', ...args.data })),
    },
    auditLog: { create: write('auditLog.create', {}) },
  };
  client.$transaction = async (callback) => callback(client);

  return { prisma: client, writes };
}

function apply(repository, template) {
  return repository.applyTemplate({
    organizationId: ORGANIZATION_ID,
    actorUserId: ACTOR_USER_ID,
    template: { addMissingSections: true, resetTheme: false, ...template },
  });
}

test('applying a template keeps existing sections and adds only the missing ones, hidden', async () => {
  const { prisma, writes } = websitesPrisma({
    homeSections: [
      { id: 's1', type: 'hero', order: 0, content: { variant: 'cover', headline: 'Ours' } },
      { id: 's2', type: 'contact', order: 1, content: { variant: 'footer' } },
    ],
  });

  const result = await apply(new WebsitesRepository(prisma), { templateId: 'city' });

  const created = writes.filter((entry) => entry.operation === 'websiteSection.create');
  assert.deepEqual(
    created.map((entry) => entry.args.data.type),
    ['live', 'schedule', 'giving', 'footer'],
  );
  assert.ok(created.every((entry) => entry.args.data.hidden === true));
  assert.deepEqual(
    created.map((entry) => entry.args.data.order),
    [2, 3, 4, 5],
  );
  assert.equal(
    writes.some((entry) => entry.operation === 'websiteSection.update'),
    false,
  );
  assert.equal(result.addedSections, 4);
});

test('a legacy hero without a variant counts as the template hero, so it is not duplicated', async () => {
  const { prisma, writes } = websitesPrisma({
    homeSections: [{ id: 's1', type: 'hero', order: 0, content: { headline: 'Ours' } }],
  });

  await apply(new WebsitesRepository(prisma), { templateId: 'default' });

  const created = writes.filter((entry) => entry.operation === 'websiteSection.create');
  assert.deepEqual(
    created.map((entry) => `${entry.args.data.type}:${entry.args.data.content.variant}`),
    ['contact:contact', 'contact:footer'],
  );
});

test('the template id is merged into settings without touching the rest', async () => {
  const { prisma, writes } = websitesPrisma({ homeSections: [] });

  await apply(new WebsitesRepository(prisma), { templateId: 'city', addMissingSections: false });

  const update = writes.find((entry) => entry.operation === 'organizationWebsite.update');
  assert.deepEqual(update.args.data.settings, {
    template: 'city',
    navigation: [{ label: 'Give', href: '/give' }],
  });
  assert.equal('theme' in update.args.data, false);
  assert.equal(
    writes.some((entry) => entry.operation === 'websiteSection.create'),
    false,
  );
});

test('resetTheme overwrites theme colours with the template ones', async () => {
  const { prisma, writes } = websitesPrisma({ homeSections: [] });

  await apply(new WebsitesRepository(prisma), { templateId: 'city', resetTheme: true });

  const update = writes.find((entry) => entry.operation === 'organizationWebsite.update');
  assert.deepEqual(update.args.data.theme, { accent: '#ffffff', background: '#ffffff' });
});

test('without a home page the template creates one as a draft with visible sections', async () => {
  const { prisma, writes } = websitesPrisma();

  const result = await apply(new WebsitesRepository(prisma), { templateId: 'city' });

  const create = writes.find((entry) => entry.operation === 'websitePage.create');
  assert.equal(create.args.data.status, 'DRAFT');
  assert.equal(create.args.data.organizationId, ORGANIZATION_ID);
  assert.equal(create.args.data.sections.create.length, 5);
  assert.ok(create.args.data.sections.create.every((section) => section.hidden === false));
  assert.equal(result.addedSections, 5);
});

test('applying a template writes an audit entry with the actor', async () => {
  const { prisma, writes } = websitesPrisma({ homeSections: [] });

  await apply(new WebsitesRepository(prisma), { templateId: 'city' });

  const audit = writes.find((entry) => entry.operation === 'auditLog.create');
  assert.equal(audit.args.data.actorUserId, ACTOR_USER_ID);
  assert.equal(audit.args.data.entityType, 'OrganizationWebsite');
  assert.equal(audit.args.data.metadata.templateId, 'city');
});

test('a website owned by another organization is not found and nothing is written', async () => {
  const { prisma, writes } = websitesPrisma({ websiteOrganizationId: 'organization-b' });

  await assert.rejects(
    apply(new WebsitesRepository(prisma), { templateId: 'city' }),
    /WEBSITE_NOT_FOUND/,
  );
  assert.deepEqual(writes, []);
});

test('settings updates patch stored json instead of replacing it', async () => {
  const { prisma, writes } = websitesPrisma({ homeSections: [] });

  await new WebsitesRepository(prisma).updateSettings({
    organizationId: ORGANIZATION_ID,
    actorUserId: ACTOR_USER_ID,
    settings: { title: 'Grace', theme: { accent: '#000000' }, settings: { template: 'city' } },
  });

  const update = writes.find((entry) => entry.operation === 'organizationWebsite.update');
  assert.deepEqual(update.args.data.settings, {
    template: 'city',
    navigation: [{ label: 'Give', href: '/give' }],
  });
  assert.deepEqual(update.args.data.theme, { accent: '#000000', background: '#ffffff' });
});

test('variant defaults are found for variants the home page does not use', () => {
  const split = websiteTemplateVariantContent('city', 'hero', 'split');
  assert.equal(split.primaryLabel, 'Plan a visit');
  assert.equal(
    websiteTemplate('city').home.some((section) => section.variant === 'split'),
    false,
  );

  assert.equal(
    websiteTemplateVariantContent('city', 'about', 'columns').title,
    'What holds us together',
  );
});

test('variant defaults still answer for the sections a home page does use', () => {
  assert.equal(
    websiteTemplateVariantContent('default', 'hero', 'hero').headline,
    'Welcome to our church',
  );
  assert.equal(
    websiteTemplateVariantContent('city', 'hero', 'cover').headline,
    'You are welcome here',
  );
});

test('an unknown variant has no defaults instead of borrowing another one', () => {
  assert.equal(websiteTemplateVariantContent('city', 'about', 'nope'), undefined);
  assert.equal(websiteTemplateVariantContent('default', 'hero', 'split'), undefined);
});

test('the city starter pages are the sets the editor offers, in order', () => {
  const key = (section) => `${section.type}:${section.variant}`;
  const pages = websiteTemplate('city').pages;

  assert.deepEqual(pages.about.map(key), ['about:text', 'about:columns', 'footer:columns']);
  assert.deepEqual(pages.contacts.map(key), ['contact:details', 'footer:columns']);
  assert.deepEqual(pages.giving.map(key), ['giving:ways', 'footer:columns']);
});

test('a starter page footer leaves the copyright to the website title', () => {
  for (const preset of ['about', 'contacts', 'giving']) {
    const footer = websiteTemplate('city').pages[preset].at(-1);
    assert.equal(footer.type, 'footer');
    assert.equal('copyright' in footer.content, false);
  }
});

test('the about starter page sends its visit link to the home location anchor', () => {
  const [intro] = websiteTemplate('city').pages.about;
  assert.equal(intro.content.primaryHref, '/#location');
});
