import assert from 'node:assert/strict';
import test from 'node:test';
import type { UIMessage } from 'ai';
import './support/web-module-hooks.ts';

const { aiAssistantPageContext } =
  await import('../apps/web/src/features/ai-assistant/lib/page-context.ts');
const {
  aiAssistantChatRequestBody,
  isAiAssistantApprovalContinuation,
  isAiAssistantSettledApprovalReply,
} = await import('../apps/web/src/features/ai-assistant/lib/chat-request.ts');
const { aiAssistantChatErrorKind } =
  await import('../apps/web/src/features/ai-assistant/lib/chat-error.ts');
const { aiAssistantUsageDisplay } =
  await import('../apps/web/src/features/ai-assistant/lib/usage-display.ts');
const { aiAssistantEntityLinkRoute } =
  await import('../apps/web/src/features/ai-assistant/lib/entity-links.ts');
const {
  aiAssistantToolResult,
  aiAssistantToolStatus,
  isAiAssistantAwaitingReply,
  isVisibleAiAssistantTool,
} = await import('../apps/web/src/features/ai-assistant/lib/tool-parts.ts');

const ORG = '11111111-1111-4111-8111-111111111111';
const ENTITY = '22222222-2222-4222-8222-222222222222';
const CONVERSATION = '33333333-3333-4333-8333-333333333333';
const UI_CONTEXT = { module: 'home' as const, timeZone: 'Europe/Kyiv' };

test('the page context follows the dashboard section', () => {
  assert.deepEqual(aiAssistantPageContext(`/dashboard/${ORG}`), { module: 'home' });
  assert.deepEqual(aiAssistantPageContext(`/dashboard/${ORG}/`), { module: 'home' });
  assert.deepEqual(aiAssistantPageContext(`/dashboard/${ORG}/members`), { module: 'members' });
  assert.deepEqual(aiAssistantPageContext(`/dashboard/${ORG}/groups`), { module: 'groups' });
  assert.deepEqual(aiAssistantPageContext(`/dashboard/${ORG}/calendar`), { module: 'calendar' });
  assert.deepEqual(aiAssistantPageContext(`/dashboard/${ORG}/prayer-requests`), {
    module: 'prayerRequests',
  });
  assert.deepEqual(aiAssistantPageContext(`/dashboard/${ORG}/budget`), { module: 'budget' });
  assert.deepEqual(aiAssistantPageContext(`/dashboard/${ORG}/knowledge`), { module: 'knowledge' });
  assert.deepEqual(aiAssistantPageContext('/profile'), { module: 'other' });
});

test('a detail page names the member or group being viewed', () => {
  assert.deepEqual(aiAssistantPageContext(`/dashboard/${ORG}/members/${ENTITY}`), {
    module: 'members',
    membershipId: ENTITY,
  });
  assert.deepEqual(aiAssistantPageContext(`/dashboard/${ORG}/groups/${ENTITY}`), {
    module: 'groups',
    groupId: ENTITY,
  });
});

test('a detail segment that is not an id is left out rather than sent', () => {
  assert.deepEqual(aiAssistantPageContext(`/dashboard/${ORG}/groups/board`), { module: 'groups' });
});

test('a new user message is sent alone, without the history', () => {
  const messages: UIMessage[] = [
    { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Earlier question' }] },
    { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Earlier answer' }] },
    { id: 'u2', role: 'user', parts: [{ type: 'text', text: '  Who leads the choir?  ' }] },
  ];

  assert.deepEqual(
    aiAssistantChatRequestBody({ conversationId: CONVERSATION, messages, uiContext: UI_CONTEXT }),
    {
      conversationId: CONVERSATION,
      uiContext: UI_CONTEXT,
      message: { id: 'u2', text: 'Who leads the choir?' },
    },
  );
});

test('an approval continuation sends only the decisions awaiting the server', () => {
  const messages: UIMessage[] = [
    { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Add Anna to the choir' }] },
    {
      id: 'a1',
      role: 'assistant',
      parts: [
        { type: 'step-start' },
        {
          type: 'tool-searchMembers',
          toolCallId: 'call-1',
          state: 'output-available',
          input: {},
          output: { ok: true, summary: 'Found Anna', links: [] },
        },
        {
          type: 'tool-addGroupMember',
          toolCallId: 'call-2',
          state: 'approval-responded',
          input: {},
          approval: { id: 'approval-1', approved: true },
        },
        {
          type: 'tool-removeGroupMember',
          toolCallId: 'call-3',
          state: 'approval-responded',
          input: {},
          approval: { id: 'approval-2', approved: false },
        },
      ],
    },
  ];

  assert.deepEqual(
    aiAssistantChatRequestBody({ conversationId: CONVERSATION, messages, uiContext: UI_CONTEXT }),
    {
      conversationId: CONVERSATION,
      uiContext: UI_CONTEXT,
      approvals: [
        { approvalId: 'approval-1', approved: true },
        { approvalId: 'approval-2', approved: false },
      ],
    },
  );
});

test('nothing is sent when there is neither a message nor a decision', () => {
  assert.equal(
    aiAssistantChatRequestBody({
      conversationId: CONVERSATION,
      messages: [],
      uiContext: UI_CONTEXT,
    }),
    null,
  );
  assert.equal(
    aiAssistantChatRequestBody({
      conversationId: CONVERSATION,
      messages: [{ id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Done' }] }],
      uiContext: UI_CONTEXT,
    }),
    null,
  );
});

test('a refused chat request is classified by its error code', () => {
  const refusal = (code: string) =>
    new Error(JSON.stringify({ ok: false, error: { code, message: 'Refused' } }));

  assert.equal(aiAssistantChatErrorKind(refusal('AI_QUOTA_EXHAUSTED')), 'quotaExhausted');
  assert.equal(aiAssistantChatErrorKind(refusal('AI_ASSISTANT_UNAVAILABLE')), 'unavailable');
  assert.equal(aiAssistantChatErrorKind(refusal('AI_DUPLICATE_MESSAGE')), 'duplicate');
  assert.equal(aiAssistantChatErrorKind(refusal('AI_CONFIRMATION_LIMIT')), 'confirmationLimit');
  assert.equal(aiAssistantChatErrorKind(refusal('REQUEST_FAILED')), 'generic');
  assert.equal(aiAssistantChatErrorKind(new Error('Failed to fetch')), 'generic');
});

test('owners and admins always see the counter', () => {
  assert.deepEqual(
    aiAssistantUsageDisplay({
      used: 10,
      limit: 250,
      periodEndsAt: '2026-10-01',
      canViewCounter: true,
    }),
    { kind: 'counter', used: 10, limit: 250 },
  );
});

test('other members are warned only when a fifth of the allowance or less remains', () => {
  const usage = (used: number) => ({
    used,
    limit: 250,
    periodEndsAt: '2026-10-01',
    canViewCounter: false,
  });

  assert.deepEqual(aiAssistantUsageDisplay(usage(199)), { kind: 'hidden' });
  assert.deepEqual(aiAssistantUsageDisplay(usage(200)), { kind: 'warning', remaining: 50 });
  assert.deepEqual(aiAssistantUsageDisplay(usage(249)), { kind: 'warning', remaining: 1 });
});

test('an exhausted allowance is shown to everyone', () => {
  for (const canViewCounter of [true, false]) {
    assert.deepEqual(
      aiAssistantUsageDisplay({
        used: 260,
        limit: 250,
        periodEndsAt: '2026-10-01',
        canViewCounter,
      }),
      { kind: 'exhausted', periodEndsAt: '2026-10-01' },
    );
  }
});

test('entity links open the record when it has an id and the list otherwise', () => {
  assert.equal(
    aiAssistantEntityLinkRoute(ORG, { kind: 'member', id: ENTITY, label: 'Anna' }),
    `/dashboard/${ORG}/members/${ENTITY}`,
  );
  assert.equal(
    aiAssistantEntityLinkRoute(ORG, { kind: 'member', id: null, label: 'Members' }),
    `/dashboard/${ORG}/members`,
  );
  assert.equal(
    aiAssistantEntityLinkRoute(ORG, { kind: 'group', id: ENTITY, label: 'Choir' }),
    `/dashboard/${ORG}/groups/${ENTITY}`,
  );
  assert.equal(
    aiAssistantEntityLinkRoute(ORG, { kind: 'group', id: null, label: 'Groups' }),
    `/dashboard/${ORG}/groups`,
  );
  assert.equal(
    aiAssistantEntityLinkRoute(ORG, { kind: 'calendar', id: ENTITY, label: 'Sunday service' }),
    `/dashboard/${ORG}/calendar`,
  );
  assert.equal(
    aiAssistantEntityLinkRoute(ORG, { kind: 'prayerRequests', id: ENTITY, label: 'Prayer' }),
    `/dashboard/${ORG}/prayer-requests`,
  );
  assert.equal(
    aiAssistantEntityLinkRoute(ORG, { kind: 'budget', id: null, label: 'Budget' }),
    `/dashboard/${ORG}/budget`,
  );
  assert.equal(
    aiAssistantEntityLinkRoute(ORG, { kind: 'knowledge', id: null, label: 'Knowledge' }),
    `/dashboard/${ORG}/knowledge`,
  );
  assert.equal(
    aiAssistantEntityLinkRoute(ORG, { kind: 'importantDates', id: null, label: 'Dates' }),
    `/dashboard/${ORG}/knowledge?view=dates`,
  );
});

test('tool results keep the common envelope and a handled failure reads as an error', () => {
  assert.deepEqual(
    aiAssistantToolResult({ ok: true, summary: 'Found 2', links: [], members: [{ id: 'm1' }] }),
    { ok: true, summary: 'Found 2', links: [] },
  );
  assert.equal(aiAssistantToolResult({ unexpected: true }), null);

  const part = (output: unknown) => ({
    type: 'tool-getGroup' as const,
    toolCallId: 'call-1',
    state: 'output-available' as const,
    input: {},
    output,
  });

  assert.equal(aiAssistantToolStatus(part({ ok: true, summary: 'Choir', links: [] })), 'done');
  assert.equal(aiAssistantToolStatus(part({ ok: false, error: 'Not found' })), 'error');
});

test('the internal tool-group switch is never shown', () => {
  assert.equal(isVisibleAiAssistantTool('enableToolGroups'), false);
  assert.equal(isVisibleAiAssistantTool('searchMembers'), true);
});

test('a reply whose confirmed action already ran is reloaded rather than resent', () => {
  const approval = { id: 'approval-1', approved: true as const };
  const settled: UIMessage[] = [
    { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Add Maria to Youth' }] },
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-addGroupMember',
          toolCallId: 'call-1',
          state: 'output-available',
          input: {},
          output: { ok: true, summary: 'Added.', links: [] },
          approval,
        },
      ],
    },
  ];
  const plainReply: UIMessage[] = [
    { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
    { id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'Hi' }] },
  ];

  assert.equal(isAiAssistantSettledApprovalReply(settled), true);
  assert.equal(isAiAssistantApprovalContinuation(settled), false);
  assert.equal(isAiAssistantSettledApprovalReply(plainReply), false);
});

test('the waiting indicator shows whenever the assistant works with nothing moving on screen', () => {
  const user: UIMessage = { id: 'u', role: 'user', parts: [{ type: 'text', text: 'Hi' }] };
  const reply = (parts: UIMessage['parts']): UIMessage[] => [
    user,
    { id: 'a', role: 'assistant', parts },
  ];
  const doneTool = {
    type: 'tool-listCalendarEvents' as const,
    toolCallId: 'c1',
    state: 'output-available' as const,
    input: {},
    output: { ok: true, summary: '3 events.', links: [] },
  };

  assert.equal(isAiAssistantAwaitingReply('submitted', [user]), true);
  assert.equal(isAiAssistantAwaitingReply('streaming', reply([])), true);
  assert.equal(isAiAssistantAwaitingReply('streaming', reply([doneTool])), true);
  assert.equal(
    isAiAssistantAwaitingReply(
      'streaming',
      reply([
        { type: 'tool-enableToolGroups', toolCallId: 'c0', state: 'input-available', input: {} },
      ]),
    ),
    true,
  );
  assert.equal(
    isAiAssistantAwaitingReply(
      'streaming',
      reply([{ type: 'reasoning', text: '…', state: 'streaming' }]),
    ),
    true,
  );
  assert.equal(
    isAiAssistantAwaitingReply(
      'streaming',
      reply([
        { type: 'tool-upcomingServices', toolCallId: 'c2', state: 'input-available', input: {} },
      ]),
    ),
    false,
  );
  assert.equal(
    isAiAssistantAwaitingReply(
      'streaming',
      reply([{ type: 'text', text: 'On Sunday', state: 'streaming' }]),
    ),
    false,
  );
  assert.equal(
    isAiAssistantAwaitingReply(
      'streaming',
      reply([{ type: 'text', text: 'Done.', state: 'done' }]),
    ),
    true,
  );
  assert.equal(isAiAssistantAwaitingReply('ready', reply([doneTool])), false);
  assert.equal(isAiAssistantAwaitingReply('error', [user]), false);
});
