require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { setImmediate: nextTurn, setTimeout: sleep } = require('node:timers/promises');
const { ForbiddenException } = require('@nestjs/common');
const { simulateReadableStream } = require('ai');
const { MockLanguageModelV4 } = require('ai/test');
const { AiAssistantService } = require('../dist/modules/ai-assistant/ai-assistant.service.js');

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '99999999-9999-4999-8999-999999999999';
const USER = '22222222-2222-4222-8222-222222222222';
const CONVERSATION = '33333333-3333-4333-8333-333333333333';
const YOUTH = '44444444-4444-4444-8444-444444444444';
const WORSHIP = '55555555-5555-4555-8555-555555555555';
const MARIA = '66666666-6666-4666-8666-666666666666';
const MARIA_OTHER = '77777777-7777-4777-8777-777777777777';
// A fixed clock keeps billing periods and relative dates stable whatever day the suite runs.
const NOW = new Date('2026-10-01T09:00:00.000Z');
const EVENT = '88888888-8888-4888-8888-888888888888';

const USAGE = {
  inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

function toolCallTurn(toolName, input, toolCallId = 'call-1') {
  return [
    { type: 'tool-call', toolCallId, toolName, input: JSON.stringify(input) },
    {
      type: 'finish',
      finishReason: { unified: 'tool-calls', raw: undefined },
      usage: USAGE,
      providerMetadata: { openrouter: { usage: { cost: 0.0004 } } },
    },
  ];
}

function textTurn(text) {
  return [
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' },
    {
      type: 'finish',
      finishReason: { unified: 'stop', raw: undefined },
      usage: USAGE,
      providerMetadata: { openrouter: { usage: { cost: 0.0001 } } },
    },
  ];
}

function groupDetail(id, name, memberIds) {
  return {
    id,
    name,
    icon: 'users',
    color: '#000000',
    description: null,
    members: memberIds.map((membershipId) => ({
      membershipId,
      displayName: membershipId === MARIA ? 'Maria Petrenko' : 'Someone',
      photoUrl: null,
      role: 'MEMBER',
      responsibility: null,
    })),
  };
}

function member(id, displayName) {
  return {
    id,
    role: 'MEMBER',
    status: 'ACTIVE',
    groups: [{ id: YOUTH, name: 'Youth' }],
    profile: {
      displayName,
      email: 'maria@example.com',
      phone: null,
      birthday: null,
      anniversary: null,
      memberSince: null,
    },
  };
}

function createRepository({ usedActions = 0, conversation = null, subscription }) {
  const state = {
    conversations: new Map(conversation ? [[conversation.id, conversation]] : []),
    messages: new Map(),
    requests: new Map(),
    executions: new Map(),
    usage: new Map(),
    usedActions,
    released: 0,
    rejected: [],
    saves: [],
    modelUsage: [],
    failTelemetry: false,
  };
  let requestCounter = 0;

  const repository = {
    state,
    findSubscriptionState: async () => subscription,
    findUserLocale: async () => 'en',
    findOrganizationName: async () => 'Grace Church',
    findUsage: async () => state.usedActions,
    reserveAction: async (_organizationId, _periodStart, limit) => {
      if (state.usedActions >= limit) return false;
      state.usedActions += 1;
      return true;
    },
    releaseAction: async () => {
      state.usedActions -= 1;
      state.released += 1;
    },
    findConversation: async (id) => state.conversations.get(id) ?? null,
    createConversation: async (input) => {
      if (!state.conversations.has(input.id)) state.conversations.set(input.id, input);
    },
    listConversations: async () => [...state.conversations.values()],
    listMessages: async (conversationId) => state.messages.get(conversationId) ?? [],
    saveTurn: async (conversationId, writes, pendingExecutions) => {
      state.saves.push(JSON.parse(JSON.stringify(writes)));
      const rows = (state.messages.get(conversationId) ?? []).filter(
        (row) => !writes.removedClientIds.includes(row.clientId),
      );
      for (const upsert of JSON.parse(JSON.stringify(writes.upserts))) {
        const index = rows.findIndex((row) => row.clientId === upsert.clientId);
        if (index === -1) rows.push(upsert);
        else rows[index] = upsert;
      }
      rows.sort((left, right) => left.position - right.position);
      state.messages.set(conversationId, rows);
      for (const execution of pendingExecutions) {
        const key = `${execution.conversationId}:approval:${execution.approvalId}`;
        if (!state.executions.has(key)) {
          state.executions.set(key, {
            ...execution,
            id: `execution-${String(state.executions.size + 1)}`,
            status: 'PENDING_APPROVAL',
          });
        }
      }
    },
    deleteConversationWithoutMessages: async (conversationId) => {
      if (!state.messages.has(conversationId)) state.conversations.delete(conversationId);
    },
    startRequest: async (input) => {
      for (const request of state.requests.values()) {
        if (
          input.clientMessageId &&
          request.conversationId === input.conversationId &&
          request.clientMessageId === input.clientMessageId
        ) {
          const {
            DuplicateAiRequestError,
          } = require('../dist/modules/ai-assistant/repositories/ai-assistant.repository.js');
          throw new DuplicateAiRequestError();
        }
      }
      requestCounter += 1;
      const id = `request-${requestCounter}`;
      state.requests.set(id, { ...input, status: 'RUNNING' });
      return id;
    },
    finishRequest: async (id, input, modelUsage) => {
      if (state.failTelemetry) throw new Error('database unavailable');
      state.requests.set(id, {
        ...state.requests.get(id),
        ...input,
        ...(input.status === 'FAILED' ? { clientMessageId: null } : {}),
      });
      for (const usage of modelUsage) {
        const duplicate = state.modelUsage.some(
          (row) => row.requestId === id && row.stepIndex === usage.stepIndex,
        );
        if (!duplicate) state.modelUsage.push({ ...usage, requestId: id });
      }
    },
    findProposingRequestId: async (conversationId, approvalId) => {
      const execution = [...state.executions.values()].find(
        (candidate) =>
          candidate.conversationId === conversationId && candidate.approvalId === approvalId,
      );
      if (!execution) return null;
      return state.requests.get(execution.requestId)?.actionRequestId ?? execution.requestId;
    },
    countConfirmations: async (actionRequestId) =>
      [...state.requests.values()].filter(
        (request) => request.actionRequestId === actionRequestId && request.kind === 'APPROVAL',
      ).length,
    recordToolExecution: async (input) => {
      state.executions.set(
        `${input.conversationId}:read:${String(state.executions.size + 1)}`,
        input,
      );
    },
    rejectPendingExecution: async (input) => {
      state.rejected.push(input.approvalId);
      for (const execution of state.executions.values()) {
        if (execution.approvalId === input.approvalId && execution.status === 'PENDING_APPROVAL') {
          execution.status = 'REJECTED';
        }
      }
    },
    claimApprovedExecution: async (input) => {
      const execution = state.executions.get(
        `${input.conversationId}:approval:${input.approvalId}`,
      );
      if (!execution || execution.status !== 'PENDING_APPROVAL') return null;
      execution.status = 'EXECUTING';
      return execution.id;
    },
    completeToolExecution: async (input) => {
      const execution = [...state.executions.values()].find((row) => row.id === input.executionId);
      Object.assign(execution, {
        status: input.status,
        resultSummary: input.resultSummary,
        errorMessage: input.errorMessage,
      });
    },
  };

  return repository;
}

function createHarness(options = {}) {
  const {
    role = 'OWNER',
    permissions = [],
    subscription = {
      status: 'ACTIVE',
      isExempt: false,
      currentPeriodEndsAt: new Date('2026-10-15T00:00:00.000Z'),
    },
    enforcementEnabled = true,
    enabled = true,
    limit = 250,
    turns = [],
    usedActions = 0,
    conversation = null,
    members = [member(MARIA, 'Maria Petrenko')],
    failingModel = false,
    failingCalls = failingModel ? Infinity : 0,
  } = options;

  const calls = {
    addMembers: [],
    moveMember: [],
    createPrayer: [],
    createEvent: [],
    updateEvent: [],
    budgetReads: [],
    offeredTools: [],
    instructions: [],
    memberSearches: [],
    audit: [],
    modelCalls: 0,
  };
  const prisma = {
    user: {
      findUnique: async () => ({
        platformRole: 'USER',
        deletedAt: null,
        memberships: role ? [{ role, permissions }] : [],
      }),
    },
    organization: { findFirst: async () => ({ id: ORG }) },
  };
  const config = new Map([
    ['AI_ASSISTANT_ENABLED', enabled],
    ['AI_PROVIDER', 'openrouter'],
    ['AI_MODEL', 'deepseek/deepseek-v4.1-flash'],
    ['AI_MONTHLY_ACTION_LIMIT', limit],
    ['AI_MAX_STEPS', 8],
    ['AI_REQUEST_TIMEOUT_MS', 60_000],
  ]);
  const configService = {
    get: (key) => config.get(key),
    getOrThrow: (key) => {
      if (!config.has(key)) throw new Error(`Missing config ${key}`);
      return config.get(key);
    },
  };
  const entitlementsService = {
    isEnforcementEnabled: () => enforcementEnabled,
    assert: async () => {
      if (subscription && subscription.status !== 'ACTIVE' && !subscription.isExempt) {
        throw new ForbiddenException({ code: 'ORGANIZATION_RESTRICTED', message: 'Restricted' });
      }
    },
  };
  const auditService = { record: async (input) => calls.audit.push(input) };
  const model = new MockLanguageModelV4({
    modelId: options.modelId ?? 'deepseek/deepseek-v4.1-flash',
    doStream: async (callOptions) => {
      calls.modelCalls += 1;
      calls.offeredTools.push((callOptions.tools ?? []).map((offered) => offered.name));
      calls.instructions.push(
        callOptions.prompt
          .filter((message) => message.role === 'system')
          .map((message) => message.content)
          .join('\n'),
      );
      if (calls.modelCalls <= failingCalls) throw new Error('provider down');
      if (calls.failAfter !== undefined && calls.modelCalls > calls.failAfter) {
        throw new Error('provider down mid-request');
      }
      const chunks = turns[calls.modelCalls - 1] ?? textTurn('Done.');
      return {
        stream: simulateReadableStream({
          chunks,
          initialDelayInMs: null,
          chunkDelayInMs: options.chunkDelayInMs ?? null,
        }),
      };
    },
  });
  const modelProvider = {
    providerName: 'openrouter',
    modelId: 'deepseek/deepseek-v4.1-flash',
    pricing: { inputUsdPerMillionTokens: null, outputUsdPerMillionTokens: null },
    languageModel: () => model,
  };
  const membershipsService = {
    listForOrganization: async (
      organizationId,
      userId,
      access,
      tab,
      type,
      search,
      groups,
      page,
      pageSize,
      membershipId,
    ) => {
      calls.memberSearches.push({ organizationId, search, membershipId });
      const matches = members.filter(
        (candidate) =>
          (!membershipId || candidate.id === membershipId) &&
          candidate.profile.displayName.toLowerCase().includes(search.toLowerCase()),
      );
      return {
        members: matches,
        pagination: { total: matches.length },
        counts: { active: members.length, archived: 0 },
      };
    },
  };
  const groups = new Map([
    [YOUTH, groupDetail(YOUTH, 'Youth', [MARIA])],
    [WORSHIP, groupDetail(WORSHIP, 'Worship', [])],
  ]);
  const groupsService = {
    listForOrganization: async () => ({
      canManage: true,
      groups: [...groups.values()].map((group) => ({
        ...group,
        memberCount: group.members.length,
        leaders: [],
      })),
    }),
    findById: async (organizationId, groupId) => {
      const group = organizationId === ORG ? groups.get(groupId) : undefined;
      if (!group) {
        const { NotFoundException } = require('@nestjs/common');
        throw new NotFoundException('Group was not found');
      }
      return { canManage: true, group, memberCandidates: [] };
    },
    addMembers: async (organizationId, groupId, input, actorUserId) => {
      calls.addMembers.push({ organizationId, groupId, input, actorUserId });
      return groupDetail(groupId, groups.get(groupId).name, [input.members[0].membershipId]);
    },
    moveMember: async (organizationId, sourceGroupId, membershipId, input) => {
      calls.moveMember.push({ organizationId, sourceGroupId, membershipId, input });
      return {
        sourceGroup: groupDetail(sourceGroupId, groups.get(sourceGroupId).name, []),
        targetGroup: groupDetail(input.targetGroupId, groups.get(input.targetGroupId).name, [
          membershipId,
        ]),
      };
    },
  };
  const calendarEvents = new Map([
    [
      EVENT,
      {
        id: EVENT,
        occurrenceId: EVENT,
        baseEventId: EVENT,
        type: 'SERVICE',
        title: 'Sunday service',
        description: null,
        startsAt: '2026-10-04T07:00:00.000Z',
        endsAt: '2026-10-04T09:00:00.000Z',
        allDay: false,
        reminder: null,
        repeatPeriod: 'WEEKLY',
        taskCompleted: false,
        linkedMember: null,
        assignees: [],
        image: null,
        serviceDetails: {
          hasCommunion: false,
          biblePassage: null,
          preacher: { membershipId: MARIA, customName: null, displayName: 'Maria Petrenko' },
          serviceHost: null,
          worshipLead: { membershipId: null, customName: 'Guest band', displayName: 'Guest band' },
          communionLead: null,
          songs: [],
        },
      },
    ],
  ]);
  const calendarEventsService = {
    listForOrganization: async () => ({ events: options.calendarList ?? [] }),
    findItem: async (_organizationId, eventId) => calendarEvents.get(eventId),
    create: async (organizationId, input) => {
      calls.createEvent.push({ organizationId, input });
      return { title: input.title };
    },
    update: async (organizationId, eventId, input) => {
      calls.updateEvent.push({ organizationId, eventId, input });
      return { title: calendarEvents.get(eventId).title };
    },
  };
  const prayerRequestsService = {
    create: async (organizationId, input, actorUserId) => {
      calls.createPrayer.push({ organizationId, input, actorUserId });
      return { id: 'prayer-1', title: input.title };
    },
  };
  const budgetsService = {
    list: async (organizationId, year, actorUserId) => {
      calls.budgetReads.push({ organizationId, year, actorUserId });
      const totals = (income, expense) => ({
        income: { amountUah: income, amountUsd: 0, amountEur: 0 },
        expense: { amountUah: expense, amountUsd: 0, amountEur: 0 },
        exchange: { amountUah: 0, amountUsd: 0, amountEur: 0 },
        balance: { amountUah: income - expense, amountUsd: 0, amountEur: 0 },
      });
      return {
        actorRole: 'OWNER',
        canManage: true,
        year,
        baseCurrency: 'UAH',
        categories: [
          { id: 'tithes', group: 'INCOME', type: 'INCOME', name: 'Tithes', order: 0 },
          { id: 'rent', group: 'FACILITY', type: 'EXPENSE', name: 'Rent', order: 1 },
        ],
        months: [
          {
            id: 'month-9',
            year,
            month: 9,
            rowCount: 1,
            entries: [
              {
                id: 'e1',
                categoryId: 'tithes',
                rowIndex: 0,
                amountUah: 12000,
                amountUsd: 0,
                amountEur: 0,
                notes: [{ field: 'amountUah', note: 'private' }],
              },
              {
                id: 'e2',
                categoryId: 'rent',
                rowIndex: 0,
                amountUah: 5000,
                amountUsd: 0,
                amountEur: 0,
                notes: [],
              },
            ],
            exchanges: [],
            totals: totals(12000, 5000),
            rates: null,
          },
        ],
        yearTotals: totals(12000, 5000),
        groupSummaries: [],
        openingBalance: {
          sinceYear: null,
          seed: totals(0, 0).income,
          opening: totals(0, 0).income,
        },
        rates: null,
      };
    },
  };
  const repository = createRepository({ usedActions, conversation, subscription });
  const service = new AiAssistantService(
    configService,
    prisma,
    repository,
    entitlementsService,
    auditService,
    modelProvider,
    membershipsService,
    groupsService,
    calendarEventsService,
    prayerRequestsService,
    budgetsService,
  );

  return { service, repository, calls };
}

function messageRequest(text, id = 'message-1') {
  return {
    conversationId: CONVERSATION,
    message: { id, text },
    uiContext: { module: 'groups', timeZone: 'Europe/Kyiv' },
  };
}

async function settle() {
  for (let index = 0; index < 20; index += 1) {
    await nextTurn();
  }
}

async function runChat(harness, request) {
  const stream = await harness.service.chat({
    userId: USER,
    organizationId: ORG,
    channel: 'web',
    request,
    now: NOW,
  });
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  await settle();

  return chunks;
}

function lastAssistant(harness) {
  const messages = harness.repository.state.messages.get(CONVERSATION) ?? [];
  return [...messages].reverse().find((message) => message.role === 'assistant');
}

function pendingApproval(harness) {
  return lastAssistant(harness).parts.find((part) => part.state === 'approval-requested');
}

/** The latest execution row of a tool call; a reused call id can have several. */
function executionFor(harness, toolCallId) {
  return [...harness.repository.state.executions.values()]
    .filter((row) => row.toolCallId === toolCallId)
    .at(-1);
}

function usageOf(harness, requestId) {
  return harness.repository.state.modelUsage.filter((row) => row.requestId === requestId);
}

function usageTurn(text, usage, providerMetadata) {
  return [
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' },
    {
      type: 'finish',
      finishReason: { unified: 'stop', raw: undefined },
      usage,
      ...(providerMetadata ? { providerMetadata } : {}),
    },
  ];
}

function onlyRequest(harness, index = 0) {
  return [...harness.repository.state.requests.values()][index];
}

test('a read question runs the tool immediately and records one counted action with telemetry', async () => {
  const harness = createHarness({
    turns: [toolCallTurn('searchMembers', { query: 'Maria' }), textTurn('Maria is in Youth.')],
  });

  const chunks = await runChat(harness, messageRequest('Which group is Maria in?'));

  assert.ok(chunks.some((chunk) => chunk.type === 'tool-output-available'));
  assert.deepEqual(harness.calls.memberSearches[0], {
    organizationId: ORG,
    search: 'Maria',
    membershipId: undefined,
  });
  assert.equal(harness.repository.state.usedActions, 1);
  const request = onlyRequest(harness);
  assert.equal(request.status, 'SUCCEEDED');
  assert.equal(request.countedAgainstQuota, true);
  assert.deepEqual(request.toolNames, ['searchMembers']);
  const usage = usageOf(harness, 'request-1');
  assert.deepEqual(
    usage.map((row) => [row.stepIndex, row.inputTokens, row.outputTokens, row.costSource]),
    [
      [0, 100, 20, 'PROVIDER_REPORTED'],
      [1, 100, 20, 'PROVIDER_REPORTED'],
    ],
  );
  assert.deepEqual(
    usage.map((row) => row.costUsd.toString()),
    ['0.0004', '0.0001'],
  );
  assert.ok(usage.every((row) => row.organizationId === ORG && row.userId === USER));
  assert.equal(request.provider, 'openrouter');
  assert.equal(request.model, 'deepseek/deepseek-v4.1-flash');
  const stored = harness.repository.state.messages.get(CONVERSATION);
  assert.deepEqual(
    stored.map((message) => message.role),
    ['user', 'assistant'],
  );
});

test('a change is proposed for confirmation and never runs in the same request', async () => {
  const harness = createHarness({
    turns: [toolCallTurn('addGroupMember', { groupId: YOUTH, membershipId: MARIA })],
  });

  const chunks = await runChat(harness, messageRequest('Add Maria to Youth'));

  assert.ok(chunks.some((chunk) => chunk.type === 'tool-approval-request'));
  assert.equal(harness.calls.addMembers.length, 0);
  const approval = pendingApproval(harness);
  assert.equal(approval.approval.requestReason, 'Add Maria Petrenko to Youth.');
  const execution = executionFor(harness, 'call-1');
  assert.equal(execution.status, 'PENDING_APPROVAL');
  assert.equal(execution.risk, 'WRITE');
  assert.equal(execution.approvalId, approval.approval.id);
});

test('a confirmed change runs once with the server-side organization, and a replayed confirmation is refused', async () => {
  const harness = createHarness({
    turns: [
      toolCallTurn('addGroupMember', {
        groupId: YOUTH,
        membershipId: MARIA,
        organizationId: OTHER_ORG,
      }),
      textTurn('Maria was added to Youth.'),
    ],
  });
  await runChat(harness, messageRequest('Add Maria to Youth'));
  const approvalId = pendingApproval(harness).approval.id;
  const approvalRequest = {
    conversationId: CONVERSATION,
    approvals: [{ approvalId, approved: true }],
    uiContext: { module: 'groups' },
  };

  await runChat(harness, approvalRequest);

  assert.equal(harness.calls.addMembers.length, 1);
  assert.equal(harness.calls.addMembers[0].organizationId, ORG);
  assert.equal(harness.calls.addMembers[0].actorUserId, USER);
  assert.equal(harness.calls.addMembers[0].groupId, YOUTH);
  assert.equal(harness.repository.state.usedActions, 1, 'a confirmation does not cost an action');
  const execution = executionFor(harness, 'call-1');
  assert.equal(execution.status, 'SUCCEEDED');
  assert.equal(harness.calls.audit.length, 1);
  assert.equal(harness.calls.audit[0].action, 'AI_TOOL_EXECUTED');
  assert.equal(harness.calls.audit[0].metadata.toolName, 'addGroupMember');

  await assert.rejects(
    () => runChat(harness, approvalRequest),
    (error) => error.getStatus() === 409,
  );
  assert.equal(harness.calls.addMembers.length, 1);
});

test('a declined change never runs and is recorded as rejected', async () => {
  const harness = createHarness({
    turns: [
      toolCallTurn('createPrayerRequest', { title: 'Healing', description: 'Pray for Anna' }),
      textTurn('Okay, I did not create it.'),
    ],
  });
  await runChat(harness, messageRequest('Create a prayer request for Anna'));
  const approvalId = pendingApproval(harness).approval.id;

  await runChat(harness, {
    conversationId: CONVERSATION,
    approvals: [{ approvalId, approved: false }],
    uiContext: { module: 'home' },
  });

  assert.equal(harness.calls.createPrayer.length, 0);
  assert.deepEqual(harness.repository.state.rejected, [approvalId]);
  assert.equal(executionFor(harness, 'call-1').status, 'REJECTED');
});

test('a confirmation does not bypass permissions the user lacks', async () => {
  const harness = createHarness({
    role: 'MEMBER',
    permissions: [],
    turns: [
      toolCallTurn('moveGroupMember', {
        sourceGroupId: YOUTH,
        targetGroupId: WORSHIP,
        membershipId: MARIA,
      }),
      textTurn('You are not allowed to do that.'),
    ],
  });
  await runChat(harness, messageRequest('Move Maria from Youth to Worship'));
  const approvalId = pendingApproval(harness).approval.id;

  const chunks = await runChat(harness, {
    conversationId: CONVERSATION,
    approvals: [{ approvalId, approved: true }],
    uiContext: { module: 'groups' },
  });

  assert.equal(harness.calls.moveMember.length, 0);
  const output = chunks.find((chunk) => chunk.type === 'tool-output-available');
  assert.equal(output.output.ok, false);
  assert.match(output.output.error, /permission/i);
  assert.equal(executionFor(harness, 'call-1').status, 'FAILED');
});

test('the member with members.manage may move people between groups', async () => {
  const harness = createHarness({
    role: 'MEMBER',
    permissions: ['members.manage'],
    turns: [
      toolCallTurn('moveGroupMember', {
        sourceGroupId: YOUTH,
        targetGroupId: WORSHIP,
        membershipId: MARIA,
      }),
      textTurn('Moved.'),
    ],
  });
  await runChat(harness, messageRequest('Move Maria from Youth to Worship'));
  const approvalId = pendingApproval(harness).approval.id;
  await runChat(harness, {
    conversationId: CONVERSATION,
    approvals: [{ approvalId, approved: true }],
    uiContext: { module: 'groups' },
  });

  assert.equal(harness.calls.moveMember.length, 1);
  assert.equal(harness.calls.moveMember[0].input.targetGroupId, WORSHIP);
});

test('an exhausted allowance refuses the message before the model is called', async () => {
  const harness = createHarness({ limit: 250, usedActions: 250 });

  await assert.rejects(
    () => runChat(harness, messageRequest('Hello')),
    (error) => error.getStatus() === 429 && error.getResponse().code === 'AI_QUOTA_EXHAUSTED',
  );
  assert.equal(harness.calls.modelCalls, 0);
  assert.equal(onlyRequest(harness).status, 'FAILED');
  assert.equal(onlyRequest(harness).errorCode, 'AI_QUOTA_EXHAUSTED');
});

test('the last action of the allowance can still be used', async () => {
  const harness = createHarness({ limit: 250, usedActions: 249 });

  await runChat(harness, messageRequest('Hello'));

  assert.equal(harness.repository.state.usedActions, 250);
  assert.equal(onlyRequest(harness).status, 'SUCCEEDED');
});

test('organizations without an active or complimentary subscription cannot use the assistant', async () => {
  for (const status of ['PENDING', 'PAST_DUE', 'RESTRICTED', 'CANCELED']) {
    const harness = createHarness({
      subscription: { status, isExempt: false, currentPeriodEndsAt: null },
    });

    await assert.rejects(
      () => runChat(harness, messageRequest('Hello')),
      (error) =>
        error.getStatus() === 403 && error.getResponse().code === 'AI_ASSISTANT_UNAVAILABLE',
      status,
    );
    assert.equal(harness.repository.state.requests.size, 0);
  }

  const exempt = createHarness({
    subscription: { status: 'PENDING', isExempt: true, currentPeriodEndsAt: null },
  });
  await runChat(exempt, messageRequest('Hello'));
  assert.equal(onlyRequest(exempt).status, 'SUCCEEDED');
});

test('the assistant is not reachable while it is switched off', async () => {
  const harness = createHarness({ enabled: false });

  await assert.rejects(
    () => runChat(harness, messageRequest('Hello')),
    (error) => error.getStatus() === 404,
  );
});

test('a resent message is not answered twice', async () => {
  const harness = createHarness();
  await runChat(harness, messageRequest('Hello', 'message-1'));

  await assert.rejects(
    () => runChat(harness, messageRequest('Hello', 'message-1')),
    (error) => error.getStatus() === 409 && error.getResponse().code === 'AI_DUPLICATE_MESSAGE',
  );
  assert.equal(harness.calls.modelCalls, 1);
  assert.equal(harness.repository.state.usedActions, 1);
});

test("another member's conversation is not found", async () => {
  const harness = createHarness({
    conversation: { id: CONVERSATION, organizationId: ORG, userId: 'someone-else' },
  });

  await assert.rejects(
    () => runChat(harness, messageRequest('Hello')),
    (error) => error.getStatus() === 404,
  );
});

test('approval decisions cannot start a conversation or answer nothing', async () => {
  const harness = createHarness();

  await assert.rejects(
    () =>
      runChat(harness, {
        conversationId: CONVERSATION,
        approvals: [{ approvalId: 'invented', approved: true }],
        uiContext: { module: 'home' },
      }),
    (error) => error.getStatus() === 404,
  );

  await runChat(harness, messageRequest('Hello'));
  await assert.rejects(
    () =>
      runChat(harness, {
        conversationId: CONVERSATION,
        approvals: [{ approvalId: 'invented', approved: true }],
        uiContext: { module: 'home' },
      }),
    (error) => error.getStatus() === 409,
  );
});

test('a provider failure before any output refunds the action', async () => {
  const harness = createHarness({ failingModel: true });

  await runChat(harness, messageRequest('Hello'));

  assert.equal(harness.repository.state.usedActions, 0);
  assert.equal(harness.repository.state.released, 1);
  const request = onlyRequest(harness);
  assert.equal(request.status, 'FAILED');
  assert.equal(request.countedAgainstQuota, false);
});

test('an ambiguous name returns every match so the model can ask instead of acting', async () => {
  const harness = createHarness({
    members: [member(MARIA, 'Maria Petrenko'), member(MARIA_OTHER, 'Maria Kovalenko')],
    turns: [toolCallTurn('searchMembers', { query: 'Maria' }), textTurn('Which Maria?')],
  });

  const chunks = await runChat(harness, messageRequest('Add Maria to Youth'));

  const output = chunks.find((chunk) => chunk.type === 'tool-output-available').output;
  assert.equal(output.data.members.length, 2);
  assert.equal(harness.calls.addMembers.length, 0);
  assert.equal(harness.repository.state.executions.size, 1);
});

test('a multi-step request resolves names first and then proposes the change', async () => {
  const harness = createHarness({
    turns: [
      toolCallTurn('searchMembers', { query: 'Maria' }, 'call-search'),
      toolCallTurn('listGroups', {}, 'call-groups'),
      toolCallTurn('addGroupMember', { groupId: WORSHIP, membershipId: MARIA }, 'call-add'),
    ],
  });

  await runChat(harness, messageRequest('Add Maria to Worship'));

  assert.equal(harness.calls.modelCalls, 3);
  const approval = pendingApproval(harness);
  assert.equal(approval.toolCallId, 'call-add');
  assert.equal(approval.approval.requestReason, 'Add Maria Petrenko to Worship.');
  assert.deepEqual(onlyRequest(harness).toolNames, [
    'searchMembers',
    'listGroups',
    'addGroupMember',
  ]);
});

test('a tool error is reported to the model instead of failing the request', async () => {
  const harness = createHarness({
    turns: [
      toolCallTurn('getGroup', { groupId: OTHER_ORG }),
      textTurn('That group does not exist.'),
    ],
  });

  const chunks = await runChat(harness, messageRequest('Who is in that group?'));

  const output = chunks.find((chunk) => chunk.type === 'tool-output-available').output;
  assert.deepEqual(output, { ok: false, error: 'Group was not found' });
  assert.equal(onlyRequest(harness).status, 'SUCCEEDED');
});

async function confirmPending(harness, module = 'calendar') {
  const approvalId = pendingApproval(harness).approval.id;
  await runChat(harness, {
    conversationId: CONVERSATION,
    approvals: [{ approvalId, approved: true }],
    uiContext: { module, timeZone: 'Europe/Kyiv' },
  });
}

test('an event is created at the local time the user named', async () => {
  const harness = createHarness({
    turns: [
      toolCallTurn('createCalendarEvent', {
        type: 'EVENT',
        title: 'Youth night',
        date: '2026-10-03',
        startTime: '18:00',
      }),
      textTurn('Created.'),
    ],
  });
  await runChat(harness, messageRequest('Create a youth event on Saturday at 18:00'));
  assert.equal(
    pendingApproval(harness).approval.requestReason,
    ['Create "Youth night".', '• Type: EVENT', '• When: 2026-10-03 18:00 (Europe/Kyiv)'].join('\n'),
  );

  await confirmPending(harness);

  assert.equal(harness.calls.createEvent.length, 1);
  const { input } = harness.calls.createEvent[0];
  assert.equal(input.startsAt, '2026-10-03T15:00:00.000Z');
  assert.equal(input.allDay, false);
  assert.equal(input.endsAt, null);
  assert.equal(input.repeatPeriod, 'NONE');
});

test('moving a service to another time keeps its date, length and roles', async () => {
  const harness = createHarness({
    turns: [
      toolCallTurn('updateCalendarEvent', { eventId: EVENT, startTime: '11:00' }),
      textTurn('Moved.'),
    ],
  });
  await runChat(harness, messageRequest('Move this service to 11:00'));
  await confirmPending(harness);

  assert.equal(harness.calls.updateEvent.length, 1);
  const { input } = harness.calls.updateEvent[0];
  assert.equal(input.startsAt, '2026-10-04T08:00:00.000Z');
  assert.equal(input.endsAt, '2026-10-04T10:00:00.000Z');
  assert.equal(input.allDay, false);
  assert.equal(input.serviceDetails, undefined);
});

test('changing the preacher keeps the worship lead', async () => {
  const harness = createHarness({
    turns: [
      toolCallTurn('updateCalendarEvent', {
        eventId: EVENT,
        service: { preacher: { name: 'Pastor Ivan' } },
      }),
      textTurn('Updated.'),
    ],
  });
  await runChat(harness, messageRequest('Pastor Ivan preaches this Sunday instead'));
  await confirmPending(harness);

  const { input } = harness.calls.updateEvent[0];
  assert.deepEqual(input.serviceDetails.preacher, { customName: 'Pastor Ivan' });
  assert.deepEqual(input.serviceDetails.worshipLead, { customName: 'Guest band' });
  assert.equal(input.startsAt, undefined);
});

test('a message that failed before any answer can be sent again under the same id', async () => {
  const harness = createHarness({ failingCalls: 1, turns: [null, textTurn('Hello again.')] });
  await runChat(harness, messageRequest('Hello', 'message-1'));

  await runChat(harness, messageRequest('Hello', 'message-1'));

  const stored = harness.repository.state.messages.get(CONVERSATION);
  assert.deepEqual(
    stored.filter((message) => message.role === 'user').map((message) => message.clientId),
    ['message-1'],
  );
  assert.equal(stored.at(-1).role, 'assistant');
  assert.equal(harness.repository.state.usedActions, 1, 'only the answered attempt is counted');
});

test('a reply stopped in the middle of a tool call does not break the conversation', async () => {
  const harness = createHarness({ turns: [textTurn('Hello again.')] });
  harness.repository.state.conversations.set(CONVERSATION, {
    id: CONVERSATION,
    organizationId: ORG,
    userId: USER,
  });
  harness.repository.state.messages.set(CONVERSATION, [
    {
      clientId: 'message-0',
      role: 'user',
      position: 0,
      parts: [{ type: 'text', text: 'Who is in Youth?' }],
    },
    {
      clientId: 'assistant-0',
      role: 'assistant',
      position: 1,
      parts: [
        { type: 'step-start' },
        {
          type: 'tool-getGroup',
          toolCallId: 'call-0',
          state: 'input-available',
          input: { groupId: YOUTH },
        },
      ],
    },
  ]);

  await runChat(harness, messageRequest('Hello', 'message-1'));

  assert.equal(onlyRequest(harness).status, 'SUCCEEDED');
  assert.equal(harness.calls.modelCalls, 1);
});

test('a refused first message leaves no empty conversation behind', async () => {
  const harness = createHarness({ usedActions: 250 });

  await assert.rejects(() => runChat(harness, messageRequest('Hello')));

  assert.equal(harness.repository.state.conversations.size, 0);
});

test('the request that runs a confirmed tool is the one its telemetry names', async () => {
  const harness = createHarness({
    turns: [
      toolCallTurn('addGroupMember', { groupId: YOUTH, membershipId: MARIA }),
      textTurn('Added.'),
    ],
  });
  await runChat(harness, messageRequest('Add Maria to Youth'));
  await confirmPending(harness, 'groups');

  const approvalRequest = onlyRequest(harness, 1);
  assert.equal(approvalRequest.kind, 'APPROVAL');
  assert.deepEqual(approvalRequest.toolNames, ['addGroupMember']);
  assert.equal(approvalRequest.countedAgainstQuota, false);
});

test('a failed request still records what its finished steps spent', async () => {
  const harness = createHarness({
    failingCalls: 0,
    turns: [toolCallTurn('searchMembers', { query: 'Maria' })],
  });
  harness.calls.failAfter = 1;

  await runChat(harness, messageRequest('Who is Maria?'));

  const request = onlyRequest(harness);
  assert.equal(request.status, 'FAILED');
  assert.equal(
    request.countedAgainstQuota,
    true,
    'the user saw a tool run, so the action was spent',
  );
  assert.deepEqual(request.toolNames, ['searchMembers']);
  const usage = usageOf(harness, 'request-1');
  assert.equal(usage.length, 1);
  assert.equal(usage[0].inputTokens, 100);
  assert.equal(usage[0].costUsd.toString(), '0.0004');
});

test('the confirmation lists every argument that changes what happens', async () => {
  const harness = createHarness({
    turns: [
      toolCallTurn('createCalendarEvent', {
        type: 'TASK',
        title: 'Chairs',
        date: '2026-10-03',
        startTime: '09:00',
        endTime: '10:00',
        repeat: 'WEEKLY',
        reminder: 'ONE_DAY',
        assigneeMembershipIds: [MARIA],
        description: 'Set up the hall',
      }),
    ],
  });

  await runChat(harness, messageRequest('Create a weekly task for Maria'));

  assert.equal(
    pendingApproval(harness).approval.requestReason,
    [
      'Create "Chairs".',
      '• Type: TASK',
      '• When: 2026-10-03 09:00 (Europe/Kyiv)',
      '• Ends: 10:00',
      '• Repeats: WEEKLY',
      '• Reminder: ONE_DAY',
      '• Assigned to: Maria Petrenko',
      '• Description: Set up the hall',
    ].join('\n'),
  );
});

test('a prayer request confirmation shows the text every member will read', async () => {
  const harness = createHarness({
    turns: [
      toolCallTurn('createPrayerRequest', { title: 'Surgery', description: 'Pray for Anna' }),
    ],
  });

  await runChat(harness, messageRequest('Create a prayer request for Anna'));

  assert.equal(
    pendingApproval(harness).approval.requestReason,
    'Create the prayer request "Surgery". All members will be notified.\nPray for Anna',
  );
});

test('the owner can read the budget of a month, per category and without notes', async () => {
  const harness = createHarness({
    turns: [toolCallTurn('budgetSummary', { year: 2026, month: 9 }), textTurn('Income 12000 UAH.')],
  });

  const chunks = await runChat(harness, messageRequest('How much did we receive in September?'));

  const output = chunks.find((chunk) => chunk.type === 'tool-output-available').output;
  assert.equal(output.ok, true);
  assert.equal(
    output.summary,
    'Budget 2026-09: income 12000.00 UAH, expenses 5000.00 UAH, balance 7000.00 UAH.',
  );
  assert.deepEqual(
    output.data.categories.map((category) => [category.name, category.amountUah]),
    [
      ['Tithes', 12000],
      ['Rent', 5000],
    ],
  );
  assert.equal(JSON.stringify(output).includes('private'), false);
  assert.deepEqual(harness.calls.budgetReads[0], {
    organizationId: ORG,
    year: 2026,
    actorUserId: USER,
  });
});

test('only the owner may read the budget, as in the app', async () => {
  for (const role of ['ADMIN', 'MEMBER', 'VIEWER']) {
    const harness = createHarness({
      role,
      turns: [
        toolCallTurn('budgetSummary', { year: 2026 }),
        textTurn('Only the owner can see it.'),
      ],
    });

    const chunks = await runChat(harness, messageRequest('Show the budget'));

    assert.equal(harness.calls.budgetReads.length, 0, role);
    assert.ok(
      !chunks.some((chunk) => chunk.type === 'tool-output-available' && chunk.output.ok),
      role,
    );
  }
});

test('the budget tool is never offered to anyone but the owner', async () => {
  const offered = async (role) => {
    const harness = createHarness({
      role,
      turns: [toolCallTurn('enableToolGroups', { groups: ['budget'] }), textTurn('Here it is.')],
    });
    await runChat(harness, messageRequest('How much did we spend on rent this year?'));
    return harness.calls;
  };

  const owner = await offered('OWNER');
  assert.ok(owner.offeredTools.every((tools) => tools.includes('budgetSummary')));
  assert.doesNotMatch(owner.instructions[0], /cannot see the church budget/);

  for (const role of ['ADMIN', 'MEMBER', 'VIEWER']) {
    const calls = await offered(role);
    // Not on the first step, and not after the model asks for the budget group either.
    assert.equal(calls.offeredTools.length, 2, role);
    assert.ok(
      calls.offeredTools.every((tools) => !tools.includes('budgetSummary')),
      role,
    );
    assert.match(
      calls.instructions[0],
      /cannot see the church budget: only the organization owner can/,
      role,
    );
  }
});

test('a reply writes only the messages it added or changed', async () => {
  const harness = createHarness({ turns: [textTurn('Hi.'), textTurn('Hello again.')] });
  await runChat(harness, messageRequest('Hello', 'message-1'));

  await runChat(harness, messageRequest('And again', 'message-2'));

  const secondSave = harness.repository.state.saves.at(-1);
  assert.deepEqual(
    secondSave.upserts.map((row) => [row.role, row.position]),
    [
      ['user', 2],
      ['assistant', 3],
    ],
  );
  assert.deepEqual(secondSave.removedClientIds, []);
});

test('a message an older schema rejects is skipped, not deleted with the history', async () => {
  const harness = createHarness({ turns: [textTurn('Hello again.')] });
  harness.repository.state.conversations.set(CONVERSATION, {
    id: CONVERSATION,
    organizationId: ORG,
    userId: USER,
  });
  harness.repository.state.messages.set(CONVERSATION, [
    { clientId: 'old-user', role: 'user', position: 0, parts: [{ type: 'text', text: 'Hi' }] },
    {
      clientId: 'old-assistant',
      role: 'assistant',
      position: 1,
      parts: [
        {
          type: 'tool-retiredTool',
          toolCallId: 'x',
          state: 'output-available',
          input: {},
          output: {},
        },
      ],
    },
  ]);

  await runChat(harness, messageRequest('Hello', 'message-1'));

  const stored = harness.repository.state.messages.get(CONVERSATION);
  assert.deepEqual(stored.map((row) => row.clientId).slice(0, 3), [
    'old-user',
    'old-assistant',
    'message-1',
  ]);
  assert.deepEqual(harness.repository.state.saves.at(-1).removedClientIds, []);
});

test('a long calendar keeps the earliest events and says it was cut short', async () => {
  const birthday = (index) => ({
    ...(() => {
      const date = new Date(Date.UTC(2026, 10, 1 + (index % 28), 7));
      return { startsAt: date.toISOString(), endsAt: null };
    })(),
    id: `birthday-${String(index)}`,
    occurrenceId: `birthday-${String(index)}`,
    baseEventId: `birthday-${String(index)}`,
    type: 'BIRTHDAY',
    title: `Birthday ${String(index)}`,
    description: null,
    allDay: true,
    reminder: null,
    repeatPeriod: 'YEARLY',
    taskCompleted: false,
    linkedMember: null,
    assignees: [],
    image: null,
    serviceDetails: null,
  });
  // Yearly birthdays come first, as they do from the service: their base events are the oldest.
  const calendarList = [
    ...Array.from({ length: 60 }, (_, index) => birthday(index)),
    {
      ...birthday(99),
      id: EVENT,
      baseEventId: EVENT,
      occurrenceId: EVENT,
      type: 'SERVICE',
      title: 'Sunday service',
      startsAt: '2026-10-04T07:00:00.000Z',
      allDay: false,
    },
  ];
  const harness = createHarness({
    calendarList,
    turns: [
      toolCallTurn('listCalendarEvents', { from: '2026-10-01', to: '2026-11-30' }),
      textTurn('Here is what is on.'),
    ],
  });

  const chunks = await runChat(
    harness,
    messageRequest('What events are on in October and November?'),
  );

  const output = chunks.find((chunk) => chunk.type === 'tool-output-available').output;
  assert.equal(output.data.total, 61);
  assert.equal(output.data.truncated, true);
  assert.equal(output.data.events.length, 50);
  assert.equal(output.data.events[0].title, 'Sunday service');
  assert.match(output.summary, /showing the first 50/);
});

test('changing a repeating event warns that every repeat changes', async () => {
  const harness = createHarness({
    turns: [toolCallTurn('updateCalendarEvent', { eventId: EVENT, startTime: '11:00' })],
  });

  await runChat(harness, messageRequest('Move the Sunday service to 11:00'));

  assert.match(
    pendingApproval(harness).approval.requestReason,
    /This event repeats \(WEEKLY\): every repeat changes\./,
  );
});

test('cached and reasoning tokens are kept, and a call without a provider cost is priced from the table', async () => {
  const harness = createHarness({
    turns: [
      usageTurn('Hi.', {
        inputTokens: { total: 1000, noCache: 400, cacheRead: 600, cacheWrite: undefined },
        outputTokens: { total: 200, text: 150, reasoning: 50 },
      }),
    ],
  });

  await runChat(harness, messageRequest('Hello'));

  const [usage] = usageOf(harness, 'request-1');
  assert.equal(usage.inputTokens, 1000);
  assert.equal(usage.cachedInputTokens, 600);
  assert.equal(usage.outputTokens, 200);
  assert.equal(usage.reasoningTokens, 50);
  assert.equal(usage.costSource, 'PRICE_TABLE');
  assert.equal(usage.pricingVersion, 'openrouter-2026-09-30');
  // 400 * 0.30 + 600 * 0.006 + 200 * 1.20 = 363.6 per million tokens.
  assert.equal(usage.costUsd.toString(), '0.0003636');
  assert.equal(usage.billingPeriodStart.toISOString(), '2026-09-15T00:00:00.000Z');
});

test('a model without a price and without a provider cost keeps its tokens and an unknown cost', async () => {
  const harness = createHarness({
    modelId: 'someone/unpriced-model',
    turns: [usageTurn('Hi.', USAGE)],
  });

  await runChat(harness, messageRequest('Hello'));

  const [usage] = usageOf(harness, 'request-1');
  assert.equal(usage.model, 'someone/unpriced-model');
  assert.equal(usage.inputTokens, 100);
  assert.equal(usage.costSource, 'UNKNOWN');
  assert.equal(usage.costUsd, null);
});

test('a provider that reports no usage leaves the counts empty instead of guessing them', async () => {
  const harness = createHarness({
    turns: [
      usageTurn('Hi.', {
        inputTokens: {
          total: undefined,
          noCache: undefined,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: undefined, text: undefined, reasoning: undefined },
      }),
    ],
  });

  await runChat(harness, messageRequest('Hello'));

  const [usage] = usageOf(harness, 'request-1');
  assert.equal(usage.inputTokens, null);
  assert.equal(usage.outputTokens, null);
  assert.equal(usage.totalTokens, null);
  assert.equal(usage.costSource, 'UNKNOWN');
  assert.equal(usage.costUsd, null);
});

test('a confirmation is traced to the message that proposed it and costs no extra action', async () => {
  const harness = createHarness({
    turns: [
      toolCallTurn('addGroupMember', { groupId: YOUTH, membershipId: MARIA }),
      textTurn('Added.'),
    ],
  });
  await runChat(harness, messageRequest('Add Maria to Youth'));
  await confirmPending(harness, 'groups');

  const [message, confirmation] = [...harness.repository.state.requests.values()];
  assert.equal(message.actionRequestId, null);
  assert.equal(confirmation.actionRequestId, 'request-1');
  assert.equal(
    confirmation.billingPeriodStart.toISOString(),
    message.billingPeriodStart.toISOString(),
  );
  assert.equal(harness.repository.state.usedActions, 1);
  assert.equal(usageOf(harness, 'request-1').length, 1);
  assert.equal(usageOf(harness, 'request-2').length, 1);
});

test('a failure to record telemetry never fails an answered request', async () => {
  const harness = createHarness({ turns: [textTurn('Hi.')] });
  harness.repository.state.failTelemetry = true;

  const chunks = await runChat(harness, messageRequest('Hello'));

  assert.ok(chunks.some((chunk) => chunk.type === 'finish'));
  assert.equal(harness.repository.state.messages.get(CONVERSATION).at(-1).role, 'assistant');
  assert.equal(harness.repository.state.usedActions, 1);
});

async function confirmAll(harness) {
  const approvalIds = lastAssistant(harness)
    .parts.filter((part) => part.state === 'approval-requested')
    .map((part) => part.approval.id);
  await runChat(harness, {
    conversationId: CONVERSATION,
    approvals: approvalIds.map((approvalId) => ({ approvalId, approved: true })),
    uiContext: { module: 'groups', timeZone: 'Europe/Kyiv' },
  });
}

test('a tool-call id the model reuses never reports an earlier success for a new change', async () => {
  const harness = createHarness({
    turns: [
      toolCallTurn(
        'addGroupMember',
        { groupId: YOUTH, membershipId: MARIA },
        'functions.addGroupMember:0',
      ),
      textTurn('Added to Youth.'),
      toolCallTurn(
        'addGroupMember',
        { groupId: WORSHIP, membershipId: MARIA },
        'functions.addGroupMember:0',
      ),
      textTurn('Added to Worship.'),
    ],
  });
  await runChat(harness, messageRequest('Add Maria to Youth', 'message-1'));
  await confirmAll(harness);
  await runChat(harness, messageRequest('Now add her to Worship', 'message-2'));

  const chunks = await (async () => {
    const approvalId = pendingApproval(harness).approval.id;
    return runChat(harness, {
      conversationId: CONVERSATION,
      approvals: [{ approvalId, approved: true }],
      uiContext: { module: 'groups' },
    });
  })();

  assert.deepEqual(
    harness.calls.addMembers.map((call) => call.groupId),
    [YOUTH, WORSHIP],
  );
  const output = chunks.find((chunk) => chunk.type === 'tool-output-available').output;
  assert.equal(output.summary, 'Maria Petrenko was added to Worship.');
  const rows = [...harness.repository.state.executions.values()].filter(
    (row) => row.toolCallId === 'functions.addGroupMember:0',
  );
  assert.deepEqual(
    rows.map((row) => row.status),
    ['SUCCEEDED', 'SUCCEEDED'],
  );
});

test('confirmations run with a short step budget', async () => {
  const harness = createHarness({
    turns: [
      toolCallTurn('addGroupMember', { groupId: YOUTH, membershipId: MARIA }),
      ...Array.from({ length: 6 }, (_, index) =>
        toolCallTurn('searchMembers', { query: 'Maria' }, `call-read-${String(index)}`),
      ),
    ],
  });
  await runChat(harness, messageRequest('Add Maria to Youth'));
  const callsBefore = harness.calls.modelCalls;

  await confirmAll(harness);

  assert.equal(harness.calls.modelCalls - callsBefore, 3);
});

test('the last allowed confirmation may not propose yet another change', async () => {
  const harness = createHarness({
    turns: [
      toolCallTurn('addGroupMember', { groupId: YOUTH, membershipId: MARIA }, 'call-1'),
      toolCallTurn('addGroupMember', { groupId: WORSHIP, membershipId: MARIA }, 'call-2'),
      toolCallTurn(
        'setGroupMemberRole',
        { groupId: WORSHIP, membershipId: MARIA, role: 'LEADER' },
        'call-3',
      ),
      toolCallTurn('removeGroupMember', { groupId: YOUTH, membershipId: MARIA }, 'call-4'),
      textTurn('I cannot propose more changes here.'),
    ],
  });
  await runChat(harness, messageRequest('Reorganize Maria'));

  await confirmAll(harness);
  await confirmAll(harness);
  await confirmAll(harness);

  assert.deepEqual(
    harness.calls.addMembers.map((call) => call.groupId),
    [YOUTH, WORSHIP],
  );
  const denied = lastAssistant(harness).parts.find((part) => part.toolCallId === 'call-4');
  assert.equal(denied.state, 'output-denied');
  assert.equal(pendingApproval(harness), undefined);
  assert.equal(harness.repository.state.usedActions, 1);
});

test('an action that used all its confirmations refuses another one', async () => {
  const harness = createHarness({
    turns: [toolCallTurn('addGroupMember', { groupId: YOUTH, membershipId: MARIA })],
  });
  await runChat(harness, messageRequest('Add Maria to Youth'));
  for (const index of [1, 2, 3]) {
    harness.repository.state.requests.set(`earlier-${String(index)}`, {
      kind: 'APPROVAL',
      actionRequestId: 'request-1',
    });
  }

  await assert.rejects(
    () => confirmAll(harness),
    (error) => error.getStatus() === 409 && error.getResponse().code === 'AI_CONFIRMATION_LIMIT',
  );
  assert.equal(harness.calls.addMembers.length, 0);
});

test('with the allowance spent, a confirmation finishes its action but opens no new one', async () => {
  const harness = createHarness({
    limit: 1,
    turns: [
      toolCallTurn('addGroupMember', { groupId: YOUTH, membershipId: MARIA }, 'call-1'),
      toolCallTurn('addGroupMember', { groupId: WORSHIP, membershipId: MARIA }, 'call-2'),
      textTurn('Done for now.'),
    ],
  });
  await runChat(harness, messageRequest('Add Maria to Youth and Worship'));

  await confirmAll(harness);

  assert.deepEqual(
    harness.calls.addMembers.map((call) => call.groupId),
    [YOUTH],
  );
  assert.equal(
    lastAssistant(harness).parts.find((part) => part.toolCallId === 'call-2').state,
    'output-denied',
  );
});

test('a client that leaves mid-reply still gets the whole turn saved', async () => {
  const harness = createHarness({
    chunkDelayInMs: 5,
    turns: [
      [
        { type: 'text-start', id: 'text-1' },
        ...Array.from({ length: 20 }, (_, index) => ({
          type: 'text-delta',
          id: 'text-1',
          delta: `part${String(index)} `,
        })),
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage: USAGE },
      ],
    ],
  });

  const stream = await harness.service.chat({
    userId: USER,
    organizationId: ORG,
    channel: 'web',
    request: messageRequest('Tell me a long story'),
    now: NOW,
  });
  const reader = stream.getReader();
  await reader.read();
  await reader.cancel();
  await sleep(300);
  await settle();

  const text = lastAssistant(harness).parts.find((part) => part.type === 'text').text;
  assert.match(text, /part19 $/);
  assert.equal(onlyRequest(harness).status, 'SUCCEEDED');
});
