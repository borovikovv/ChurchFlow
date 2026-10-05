require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { AiToolRunner } = require('../dist/modules/ai-assistant/tools/ai-tool-runner.js');
const { knowledgeTools } = require('../dist/modules/ai-assistant/tools/knowledge.tools.js');
const {
  KnowledgeEntriesRepository,
} = require('../dist/modules/knowledge/repositories/knowledge-entries.repository');
const {
  ImportantDatesRepository,
} = require('../dist/modules/knowledge/repositories/important-dates.repository');
const { KnowledgeEntriesService } = require('../dist/modules/knowledge/knowledge-entries.service');
const { ImportantDatesService } = require('../dist/modules/knowledge/important-dates.service');

const ORG = 'organization-a';
const OTHER_ORG = 'organization-b';
const USER = 'user-1';
const NOW = new Date('2026-10-01T09:00:00.000Z');
const PREACHERS = '11111111-1111-4111-8111-111111111111';
const WORSHIP = '22222222-2222-4222-8222-222222222222';
const TEACHERS = '33333333-3333-4333-8333-333333333333';
const YOUTH = '44444444-4444-4444-8444-444444444444';
const DEACONS = '55555555-5555-4555-8555-555555555555';

function note(id, overrides = {}) {
  return {
    id,
    organizationId: ORG,
    title: id,
    content: `<p>${id}</p>`,
    category: 'OTHER',
    tags: [],
    pinned: false,
    visibility: 'MEMBERS',
    createdById: USER,
    updatedById: USER,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-02T00:00:00.000Z'),
    ...overrides,
  };
}

function importantDate(id, overrides = {}) {
  return {
    id,
    organizationId: ORG,
    title: id,
    notes: null,
    ruleKind: 'FIXED',
    month: 11,
    day: 15,
    weekday: null,
    nth: null,
    reminderLeadDays: null,
    visibility: 'MEMBERS',
    createdById: USER,
    updatedById: USER,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-02T00:00:00.000Z'),
    ...overrides,
  };
}

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some((condition) => matches(row, condition));
    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value.in)) return value.in.includes(row[key]);
      if ('has' in value) return row[key].includes(value.has);
      if ('contains' in value) {
        return row[key].toLowerCase().includes(value.contains.toLowerCase());
      }
      return true;
    }
    return row[key] === value;
  });
}

/** Applies the where clauses the knowledge repositories build, so visibility is real. */
function createPrisma({ role, notes, dates }) {
  const table = (rows) => ({
    findMany: async (args) => rows.filter((row) => matches(row, args.where)),
    findFirst: async (args) => rows.find((row) => matches(row, args.where)) ?? null,
  });

  return {
    user: {
      findUnique: async ({ select }) => ({
        platformRole: 'USER',
        deletedAt: null,
        memberships:
          select.memberships.where.organizationId === ORG ? [{ role, permissions: [] }] : [],
      }),
    },
    organization: { findFirst: async ({ where }) => (where.id === ORG ? { id: ORG } : null) },
    knowledgeEntry: table(notes),
    importantDate: table(dates),
  };
}

function group(id, name, icon) {
  return { id, name, icon, color: '#000000', description: null, memberCount: 0, leaders: [] };
}

function person(membershipId, displayName) {
  return { membershipId, customName: null, displayName, photoAssetId: null, photoUrl: null };
}

function service(id, startsAt, details = {}) {
  return {
    id,
    baseEventId: id,
    type: 'SERVICE',
    title: `Service ${id}`,
    startsAt,
    serviceDetails: {
      hasCommunion: false,
      biblePassage: null,
      preacher: null,
      serviceHost: null,
      worshipLead: null,
      communionLead: null,
      songs: [],
      ...details,
    },
  };
}

const MEMBERS = [
  { id: 'anna', status: 'ACTIVE', groupIds: [PREACHERS], profile: { displayName: 'Anna' } },
  { id: 'boris', status: 'SUSPENDED', groupIds: [PREACHERS], profile: { displayName: 'Boris' } },
  { id: 'vera', status: 'ACTIVE', groupIds: [WORSHIP], profile: { displayName: 'Vera' } },
  { id: 'taras', status: 'ACTIVE', groupIds: [TEACHERS], profile: { displayName: 'Taras' } },
  { id: 'yulia', status: 'ACTIVE', groupIds: [YOUTH], profile: { displayName: 'Yulia' } },
  { id: 'denys', status: 'ACTIVE', groupIds: [DEACONS], profile: { displayName: 'Denys' } },
];

function setup(options = {}) {
  const {
    organizationId = ORG,
    role = 'MEMBER',
    notes = [],
    dates = [],
    groups = [
      group(PREACHERS, 'Preaching', 'preaching'),
      group(WORSHIP, 'Worship', 'worship'),
      group(TEACHERS, 'Teachers', 'teaching'),
      group(YOUTH, 'Youth', 'youth'),
      group(DEACONS, 'Deacons', 'deacons'),
    ],
    events = [],
  } = options;
  const calls = { organizations: [], memberGroups: [], calendarQueries: [], executions: [] };
  const prisma = createPrisma({ role, notes, dates });
  const runner = new AiToolRunner(
    {
      prisma,
      entitlementsService: { assert: async () => undefined },
      repository: { recordToolExecution: async (input) => calls.executions.push(input) },
      auditService: { record: async () => undefined },
    },
    {
      organizationId,
      userId: USER,
      conversationId: 'conversation-1',
      requestId: 'request-1',
      confirmedApprovals: new Map(),
      locale: 'en',
      timeZone: 'Europe/Kyiv',
      now: NOW,
    },
  );
  const tools = knowledgeTools(runner, {
    knowledgeEntriesService: new KnowledgeEntriesService(
      new KnowledgeEntriesRepository(prisma),
      prisma,
    ),
    importantDatesService: new ImportantDatesService(new ImportantDatesRepository(prisma), prisma),
    groupsService: {
      listForOrganization: async (orgId) => {
        calls.organizations.push(orgId);
        return { canManage: false, groups: orgId === ORG ? groups : [] };
      },
    },
    membershipsService: {
      listForOrganization: async (orgId, _userId, _access, tab, _type, _search, groupIds) => {
        calls.organizations.push(orgId);
        calls.memberGroups.push(groupIds);
        const found = MEMBERS.filter(
          (member) =>
            orgId === ORG &&
            (tab !== 'active' || member.status !== 'ARCHIVED') &&
            member.groupIds.some((groupId) => groupIds.includes(groupId)),
        );
        return { members: found, pagination: { total: found.length } };
      },
    },
    calendarEventsService: {
      listForOrganization: async (orgId, _userId, query) => {
        calls.organizations.push(orgId);
        calls.calendarQueries.push(query);
        return { events: orgId === ORG ? events : [] };
      },
    },
  });

  const plan = (input) =>
    tools.getPlanningContext.execute(input, { toolCallId: 'call-1', messages: [] });
  const run = (toolName, input) =>
    tools[toolName].execute(input, { toolCallId: 'call-1', messages: [] });

  return { plan, run, calls };
}

const NOVEMBER = { from: '2026-11-01', to: '2026-11-30' };

test('a preaching plan takes its candidates from the preaching group, active members only', async () => {
  const { plan, calls } = setup();
  const result = await plan({ role: 'PREACHER', ...NOVEMBER });

  assert.equal(result.ok, true);
  assert.deepEqual(calls.memberGroups, [[PREACHERS]]);
  assert.deepEqual(result.data.groups, [{ groupId: PREACHERS, name: 'Preaching' }]);
  assert.deepEqual(result.data.candidates, [{ membershipId: 'anna', name: 'Anna' }]);
  assert.equal(result.data.hint, null);
});

test('each service role maps to its ministry group and its own assignment', async () => {
  const events = [
    service('nov-8', '2026-11-08T08:00:00.000Z', {
      preacher: person('anna', 'Anna'),
      worshipLead: person('vera', 'Vera'),
      serviceHost: person('taras', 'Taras'),
      communionLead: person('denys', 'Denys'),
    }),
  ];
  const expectations = [
    ['PREACHER', PREACHERS, 'Anna'],
    ['WORSHIP_LEAD', WORSHIP, 'Vera'],
    ['SERVICE_HOST', TEACHERS, 'Taras'],
    ['COMMUNION_LEAD', DEACONS, 'Denys'],
  ];

  for (const [role, groupId, assignee] of expectations) {
    const { plan, calls } = setup({ events });
    const result = await plan({ role, ...NOVEMBER });

    assert.deepEqual(calls.memberGroups, [[groupId]], role);
    assert.equal(result.data.services[0].assignee.name, assignee, role);
  }
});

test('an explicit groupId replaces the default group', async () => {
  const { plan, calls } = setup();
  const result = await plan({ role: 'PREACHER', ...NOVEMBER, groupId: YOUTH });

  assert.deepEqual(calls.memberGroups, [[YOUTH]]);
  assert.deepEqual(result.data.candidates, [{ membershipId: 'yulia', name: 'Yulia' }]);
});

test('without a matching group the plan still returns services, dates and notes with a hint', async () => {
  const { plan, calls } = setup({
    groups: [group(YOUTH, 'Youth', 'youth')],
    events: [service('nov-8', '2026-11-08T08:00:00.000Z')],
    dates: [importantDate('Church anniversary')],
    notes: [note('Hosting', { tags: ['host'] })],
  });

  for (const input of [
    { role: 'SERVICE_HOST', ...NOVEMBER },
    { role: 'PREACHER', ...NOVEMBER, groupId: PREACHERS },
  ]) {
    const result = await plan(input);

    assert.equal(result.ok, true);
    assert.deepEqual(result.data.candidates, []);
    assert.match(result.data.hint, /groupId/);
    assert.equal(result.data.services.length, 1);
    assert.equal(result.data.importantDates.length, 1);
  }
  assert.deepEqual(calls.memberGroups, []);
});

test('services in the range are listed with their assignee, earlier weeks only when assigned', async () => {
  const { plan, calls } = setup({
    events: [
      service('nov-15', '2026-11-15T08:00:00.000Z'),
      service('oct-25', '2026-10-25T08:00:00.000Z', { preacher: person('anna', 'Anna') }),
      service('oct-18', '2026-10-18T08:00:00.000Z'),
      service('nov-1', '2026-10-31T22:30:00.000Z', {
        preacher: { ...person(null, 'Guest'), customName: 'Guest' },
      }),
    ],
  });
  const result = await plan({ role: 'PREACHER', ...NOVEMBER });

  // Eight weeks back from 1 November, local midnight in Kyiv, to the end of 30 November.
  assert.deepEqual(calls.calendarQueries, [
    {
      rangeStart: '2026-09-05T21:00:00.000Z',
      rangeEnd: '2026-11-30T22:00:00.000Z',
      types: ['SERVICE'],
    },
  ]);
  assert.deepEqual(result.data.services, [
    {
      date: '2026-11-01',
      eventId: 'nov-1',
      title: 'Service nov-1',
      assignee: { membershipId: null, name: 'Guest' },
    },
    { date: '2026-11-15', eventId: 'nov-15', title: 'Service nov-15', assignee: null },
  ]);
  assert.deepEqual(result.data.recentAssignments, [
    {
      date: '2026-10-25',
      eventId: 'oct-25',
      title: 'Service oct-25',
      assignee: { membershipId: 'anna', name: 'Anna' },
    },
  ]);
});

test('important dates are resolved inside the range only', async () => {
  const { plan } = setup({
    dates: [
      importantDate('Church anniversary'),
      importantDate('Thanksgiving', {
        ruleKind: 'NTH_WEEKDAY',
        month: 10,
        day: null,
        weekday: 0,
        nth: 1,
      }),
    ],
  });
  const result = await plan({ role: 'PREACHER', ...NOVEMBER });

  assert.deepEqual(result.data.importantDates, [
    { id: 'Church anniversary', title: 'Church anniversary', dates: ['2026-11-15'] },
  ]);
});

test('notes about the role come first, are compact and capped at ten', async () => {
  const notes = [
    note('Preaching order', { tags: ['preaching'], content: `<p>${'Rotate. '.repeat(40)}</p>` }),
    note('Who may preach', { content: '<p>Only those who preach regularly.</p>' }),
    ...Array.from({ length: 12 }, (_, index) =>
      note(`Ministry ${String(index)}`, { category: 'MINISTRY' }),
    ),
    note('Unrelated'),
  ];
  const { plan } = setup({ notes });
  const result = await plan({ role: 'PREACHER', ...NOVEMBER });

  assert.equal(result.data.notes.length, 10);
  assert.deepEqual(
    result.data.notes.slice(0, 2).map((entry) => entry.id),
    ['Preaching order', 'Who may preach'],
  );
  assert.ok(result.data.notes[0].excerpt.length <= 160);
  assert.deepEqual(Object.keys(result.data.notes[0]).sort(), ['excerpt', 'id', 'title']);
  assert.equal(
    result.data.notes.some((entry) => entry.id === 'Unrelated'),
    false,
  );
});

test('a note visible to the owner only stays hidden from a member', async () => {
  const notes = [
    note('Preaching for members', { tags: ['preaching'] }),
    note('Preaching for the owner', { tags: ['preaching'], visibility: 'OWNER', pinned: true }),
    note('Pinned for admins', { pinned: true, visibility: 'ADMINS' }),
  ];

  const asMember = await setup({ notes, role: 'MEMBER' }).plan({ role: 'PREACHER', ...NOVEMBER });
  assert.deepEqual(
    asMember.data.notes.map((entry) => entry.id),
    ['Preaching for members'],
  );

  const asOwner = await setup({ notes, role: 'OWNER' }).plan({ role: 'PREACHER', ...NOVEMBER });
  assert.deepEqual(asOwner.data.notes.map((entry) => entry.id).sort(), [
    'Pinned for admins',
    'Preaching for members',
    'Preaching for the owner',
  ]);
});

test('only the organization from the tool context is read', async () => {
  const notes = [
    note('Preaching here', { tags: ['preaching'] }),
    note('Preaching elsewhere', { tags: ['preaching'], organizationId: OTHER_ORG }),
  ];
  const { plan, calls } = setup({ notes });
  const result = await plan({ role: 'PREACHER', ...NOVEMBER });

  assert.deepEqual(
    result.data.notes.map((entry) => entry.id),
    ['Preaching here'],
  );
  assert.ok(calls.organizations.every((organizationId) => organizationId === ORG));

  const outsider = setup({ organizationId: OTHER_ORG, notes });
  const refused = await outsider.plan({ role: 'PREACHER', ...NOVEMBER });
  assert.equal(refused.ok, false);
  assert.deepEqual(outsider.calls.organizations, []);
});

test('the range must be real dates in order and at most 93 days long', async () => {
  const { plan, calls } = setup();

  for (const range of [
    { from: '2026-11-30', to: '2026-11-01' },
    { from: '2026-11-01', to: '2027-02-02' },
    { from: '2026-02-30', to: '2026-03-10' },
  ]) {
    const result = await plan({ role: 'PREACHER', ...range });
    assert.equal(result.ok, false, JSON.stringify(range));
  }
  assert.deepEqual(calls.organizations, []);

  const longest = await plan({ role: 'PREACHER', from: '2026-11-01', to: '2027-02-01' });
  assert.equal(longest.ok, true);
});

test('the recorded summary carries counts only', async () => {
  const { plan, calls } = setup({
    events: [service('nov-8', '2026-11-08T08:00:00.000Z')],
    notes: [note('Secret preaching plan', { tags: ['preaching'] })],
  });
  const result = await plan({ role: 'PREACHER', ...NOVEMBER });

  assert.equal(
    result.summary,
    '1 candidates, 1 services, 0 recent assignments, 0 important dates, 1 notes.',
  );
  assert.equal(calls.executions[0].resultSummary.includes('Secret'), false);
});

const LAYERED_NOTES = [
  note('For members'),
  note('For admins', { visibility: 'ADMINS' }),
  note('For the owner', { visibility: 'OWNER' }),
];
const LAYERED_DATES = [
  importantDate('Members day'),
  importantDate('Admins day', { visibility: 'ADMINS' }),
  importantDate('Owner day', { visibility: 'OWNER' }),
];
const VISIBLE_BY_ROLE = {
  MEMBER: { notes: ['For members'], dates: ['Members day'] },
  ADMIN: { notes: ['For admins', 'For members'], dates: ['Admins day', 'Members day'] },
};

test('searchKnowledge returns, and counts, only the notes the role may read', async () => {
  for (const [role, visible] of Object.entries(VISIBLE_BY_ROLE)) {
    const { run, calls } = setup({ role, notes: LAYERED_NOTES });
    const result = await run('searchKnowledge', {});

    assert.equal(result.ok, true, role);
    assert.deepEqual(result.data.entries.map((entry) => entry.title).sort(), visible.notes, role);
    assert.equal(result.data.total, visible.notes.length, role);
    assert.equal(result.summary, `${String(visible.notes.length)} knowledge notes found.`, role);
    assert.equal(JSON.stringify(calls.executions).includes('For the owner'), false, role);
  }
});

test('getKnowledge treats a note above the role as missing', async () => {
  for (const [role, hidden] of [
    ['MEMBER', 'For admins'],
    ['MEMBER', 'For the owner'],
    ['ADMIN', 'For the owner'],
  ]) {
    const result = await setup({ role, notes: LAYERED_NOTES }).run('getKnowledge', { id: hidden });

    assert.equal(result.ok, false, `${role} ${hidden}`);
    assert.equal(JSON.stringify(result).includes(`<p>${hidden}</p>`), false, `${role} ${hidden}`);
  }

  const shared = await setup({ role: 'MEMBER', notes: LAYERED_NOTES }).run('getKnowledge', {
    id: 'For members',
  });
  assert.equal(shared.ok, true);
});

test('listImportantDates returns, and counts, only the dates the role may read', async () => {
  for (const [role, visible] of Object.entries(VISIBLE_BY_ROLE)) {
    const result = await setup({ role, dates: LAYERED_DATES }).run('listImportantDates', {});

    assert.equal(result.ok, true, role);
    assert.deepEqual(result.data.dates.map((date) => date.title).sort(), visible.dates, role);
    assert.match(
      result.summary,
      new RegExp(`^${String(visible.dates.length)} important dates`),
      role,
    );
  }
});
