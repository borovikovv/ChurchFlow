const assert = require('node:assert/strict');
const test = require('node:test');
const {
  resolveSectionsContent,
  sectionDataResolvers,
} = require('../dist/modules/websites/section-data.js');
const { toPublicSection } = require('../dist/modules/websites/public-website.js');
const { PagesService } = require('../dist/modules/pages/pages.service.js');

const context = { organizationId: '00000000-0000-4000-8000-000000000001' };
const eventRef = '11111111-1111-4111-8111-111111111111';

function section(content, overrides = {}) {
  return { id: 'section-1', type: 'about', order: 0, content, ...overrides };
}

function resolverThat(resolve) {
  return { implemented: true, resolve };
}

test('a section without a source renders the content its owner stored', async () => {
  const stored = { variant: 'cards', title: 'Our ministries', items: [{ title: 'Youth' }] };
  const [resolved] = await resolveSectionsContent([section(stored)], context);

  assert.deepEqual(resolved, { id: 'section-1', type: 'about', order: 0, content: stored });
});

test('an explicit manual source also renders the stored content', async () => {
  const stored = { title: 'Our ministries', source: { mode: 'manual' } };
  const [resolved] = await resolveSectionsContent([section(stored)], context);

  assert.deepEqual(resolved.content, stored);
});

test('unreadable content and an unreadable source stay manual', async () => {
  const resolved = await resolveSectionsContent(
    [section(null), section({ title: 'Kept', source: { mode: 'unknown-mode' } })],
    context,
  );

  assert.deepEqual(resolved[0].content, {});
  assert.deepEqual(resolved[1].content, { title: 'Kept', source: { mode: 'unknown-mode' } });
});

test('a churchflow module without a resolver falls back to the stored content', async () => {
  const stored = {
    title: 'Upcoming events',
    body: 'Manual copy until events are connected',
    source: { mode: 'churchflow', module: 'events', refs: [eventRef], limit: 3 },
  };
  const [resolved] = await resolveSectionsContent([section(stored)], context);

  assert.deepEqual(resolved.content, stored);
  assert.equal(sectionDataResolvers.events.implemented, false);
  for (const module of Object.keys(sectionDataResolvers)) {
    assert.equal(sectionDataResolvers[module].implemented, false);
  }
});

test('a resolver that throws degrades to the stored content instead of failing the page', async () => {
  const stored = { title: 'Upcoming events', source: { mode: 'churchflow', module: 'events' } };
  const [resolved] = await resolveSectionsContent([section(stored)], context, {
    resolvers: {
      ...sectionDataResolvers,
      events: resolverThat(() => Promise.reject(new Error('module unavailable'))),
    },
  });

  assert.deepEqual(resolved.content, stored);
});

test('a resolver that never settles degrades to the stored content', async () => {
  const stored = { title: 'Upcoming events', source: { mode: 'churchflow', module: 'events' } };
  const [resolved] = await resolveSectionsContent([section(stored)], context, {
    resolvers: { ...sectionDataResolvers, events: resolverThat(() => new Promise(() => {})) },
    timeoutMs: 10,
  });

  assert.deepEqual(resolved.content, stored);
});

test('sections resolve concurrently rather than one after another', async () => {
  let started = 0;
  let release = () => {};
  const allStarted = new Promise((resolve) => {
    release = resolve;
  });
  const source = { mode: 'churchflow', module: 'events' };
  const sections = ['a', 'b', 'c'].map((id, order) =>
    section({ title: id, source }, { id, order }),
  );

  const resolved = await resolveSectionsContent(sections, context, {
    resolvers: {
      ...sectionDataResolvers,
      events: resolverThat(async (request) => {
        started += 1;
        // A sequential pipeline would wait here forever and time out instead.
        if (started === sections.length) release();
        await allStarted;

        return { ...request.content, body: `live ${request.source.module}` };
      }),
    },
    timeoutMs: 1000,
  });

  assert.equal(started, sections.length);
  assert.deepEqual(
    resolved.map((entry) => entry.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    resolved.map((entry) => entry.content.body),
    ['live events', 'live events', 'live events'],
  );
});

test('keys a resolver adds outside the section schema never reach the public payload', async () => {
  const stored = { title: 'Upcoming events', source: { mode: 'churchflow', module: 'events' } };
  const [resolved] = await resolveSectionsContent([section(stored)], context, {
    resolvers: {
      ...sectionDataResolvers,
      events: resolverThat((request) =>
        Promise.resolve({
          ...request.content,
          items: [{ title: 'Sunday service' }],
          memberIds: ['member-1'],
          internalNote: 'do not publish',
        }),
      ),
    },
  });

  assert.deepEqual(toPublicSection(resolved), {
    id: 'section-1',
    type: 'about',
    order: 0,
    content: { title: 'Upcoming events', items: [{ title: 'Sunday service' }] },
  });
});

test('the source, its refs and its display settings stay out of the public payload', async () => {
  const stored = {
    title: 'Upcoming events',
    source: { mode: 'churchflow', module: 'events', refs: [eventRef], limit: 3 },
  };
  const resolved = await resolveSectionsContent([section(stored)], context);
  const published = toPublicSection(resolved[0]);

  assert.equal('source' in published.content, false);
  assert.equal(JSON.stringify(published).includes(eventRef), false);
  assert.equal(JSON.stringify(published).includes('churchflow'), false);
});

test('a resolver cannot publish a private field nested in the content it returns', async () => {
  const stored = { title: 'Upcoming events', source: { mode: 'churchflow', module: 'events' } };
  const [resolved] = await resolveSectionsContent([section(stored)], context, {
    resolvers: {
      ...sectionDataResolvers,
      events: resolverThat((request) =>
        Promise.resolve({
          ...request.content,
          items: [
            {
              title: 'Sunday service',
              attendeeEmail: 'private@example.com',
              internalId: '22222222-2222-4222-8222-222222222222',
            },
          ],
        }),
      ),
    },
  });
  const published = toPublicSection(resolved);

  assert.deepEqual(published.content.items, [{ title: 'Sunday service' }]);
  assert.equal(JSON.stringify(published).includes('private@example.com'), false);
  assert.equal(JSON.stringify(published).includes('internalId'), false);
});

test('a resolver that returns content a save would reject degrades to the stored content', async () => {
  const stored = {
    title: 'Upcoming events',
    body: 'Manual copy',
    source: { mode: 'churchflow', module: 'events' },
  };
  const rejected = [
    { primaryLabel: 'Give', primaryHref: 'javascript:alert(1)' },
    { items: [{ title: 'Sunday service', href: 'javascript:alert(1)' }] },
    { backgroundImageUrl: 'data:text/html,x' },
    { customLinkUrl: 'javascript:alert(1)' },
    { title: 'x'.repeat(201) },
  ];

  for (const extra of rejected) {
    const [resolved] = await resolveSectionsContent([section(stored)], context, {
      resolvers: {
        ...sectionDataResolvers,
        events: resolverThat((request) => Promise.resolve({ ...request.content, ...extra })),
      },
    });

    assert.deepEqual(resolved.content, stored, JSON.stringify(extra));
  }
});

test('an incomplete registry degrades the section instead of failing the page', async () => {
  const stored = { title: 'Upcoming events', source: { mode: 'churchflow', module: 'events' } };
  const [resolved] = await resolveSectionsContent([section(stored)], context, { resolvers: {} });

  assert.deepEqual(resolved.content, stored);
});

test('the public page and the owner preview both run the registry', async () => {
  const page = {
    organizationId: context.organizationId,
    title: 'Home',
    seo: {},
    sections: [
      {
        id: 'section-1',
        type: 'about',
        order: 0,
        hidden: false,
        content: {
          title: 'Upcoming events',
          source: { mode: 'churchflow', module: 'events', refs: [eventRef] },
        },
      },
    ],
    website: {
      id: 'website-1',
      title: 'Grace Church',
      description: null,
      theme: {},
      settings: {},
      publishedAt: new Date(),
      logoAssetId: null,
      organization: { name: 'Grace Church', slug: 'grace' },
    },
  };
  const service = new PagesService(
    { findPublicPage: () => Promise.resolve(page), findDashboardPage: () => Promise.resolve(page) },
    { getReadUrl: () => Promise.resolve({ url: 'https://cdn.example/signed.jpg' }) },
  );
  const registered = sectionDataResolvers.events;
  // Registering a resolver is all a real module does, so the call site runs as it will in production.
  sectionDataResolvers.events = resolverThat((request) =>
    Promise.resolve({ ...request.content, body: 'live copy' }),
  );

  try {
    const published = await service.findPublicPage('grace', 'home');
    const preview = await service.findPreviewPage(context.organizationId, 'page-1');

    for (const result of [published, preview]) {
      assert.equal(result.sections[0].content.body, 'live copy');
      assert.equal('source' in result.sections[0].content, false);
      assert.equal(JSON.stringify(result.sections[0]).includes(eventRef), false);
    }
  } finally {
    sectionDataResolvers.events = registered;
  }
});
