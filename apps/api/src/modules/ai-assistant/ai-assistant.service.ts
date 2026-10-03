import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@churchflow/db';
import {
  convertToModelMessages,
  getToolName,
  isStepCount,
  isToolUIPart,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';
import {
  AI_ASSISTANT_CONFIRMATION_LIMIT_ERROR_CODE,
  AI_ASSISTANT_CONFIRMATION_MAX_STEPS,
  AI_ASSISTANT_DUPLICATE_MESSAGE_ERROR_CODE,
  AI_ASSISTANT_MAX_CONFIRMATIONS_PER_ACTION,
  AI_ASSISTANT_QUOTA_EXHAUSTED_ERROR_CODE,
  AI_ASSISTANT_UNAVAILABLE_ERROR_CODE,
  appLocaleOrFallback,
  type AiAssistantAdminUsageQuery,
  type AiAssistantAdminUsageReport,
  type AiAssistantApprovalDecision,
  type AiAssistantChatRequest,
  type AiAssistantConversationsPayload,
  type AiAssistantUiContext,
  type AiAssistantTokenTotals,
  type AiAssistantUsagePayload,
} from '@churchflow/shared';
import {
  assertOrganizationAccess,
  type OrganizationAccess,
} from '../../common/guards/organization-access.guard';
import { validTimeZoneOrFallback } from '../../common/time/date-time';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BudgetsService } from '../budgets/budgets.service';
import { addMonths, BILLING_TIME_ZONE } from '../billing/billing-time';
import { EntitlementsService } from '../billing/entitlements.service';
import { CalendarEventsService } from '../calendar-events/calendar-events.service';
import { GroupsService } from '../groups/groups.service';
import { ImportantDatesService } from '../knowledge/important-dates.service';
import { KnowledgeEntriesService } from '../knowledge/knowledge-entries.service';
import { MembershipsService } from '../memberships/memberships.service';
import { PrayerRequestsService } from '../prayer-requests/prayer-requests.service';
import {
  reportingPeriod,
  resolveAiAssistantAccess,
  type AiAssistantUsagePeriod,
} from './ai-assistant-access';
import { planTurnWrites, stableJson, type AiStoredMessageState } from './ai-conversation-history';
import { buildAssistantInstructions, initialToolGroups } from './ai-assistant-prompt';
import { AiModelProvider, reportedCostUsd } from './ai-model.provider';
import {
  AI_MODEL_PRICES,
  findModelPrice,
  modelCallCost,
  type AiModelCallUsage,
} from './ai-pricing';
import {
  AiAssistantRepository,
  DuplicateAiRequestError,
  type AiRequestFinish,
  type AiPendingToolExecution,
} from './repositories/ai-assistant.repository';
import { jsonFromUnknown, type AiToolGroup } from './tools/ai-tool';
import { AiNameResolver } from './tools/ai-name-resolver';
import {
  AI_TOOL_META,
  buildAiToolSet,
  buildToolApproval,
  toolGroupOf,
  toolsInGroups,
  type AiToolSet,
} from './tools/ai-tool-registry';
import { AiToolRunner } from './tools/ai-tool-runner';
import { enableToolGroupsInputSchema } from './tools/organization.tools';

export type AiAssistantChannel = 'web' | 'telegram';

const CONVERSATION_TITLE_MAX_LENGTH = 80;
// What the user can see arrive. Lifecycle chunks such as start or error do not spend an action.
const OUTPUT_CHUNK_TYPES = new Set<string>([
  'text-delta',
  'reasoning-delta',
  'tool-input-start',
  'tool-call',
]);
const PROVIDER_ERROR_MESSAGE = 'ChurchFlow AI could not answer right now. Please try again.';

interface AiChatInput {
  userId: string;
  organizationId: string;
  channel: AiAssistantChannel;
  request: AiAssistantChatRequest;
  now?: Date;
}

interface AiConversationHistory {
  messages: UIMessage[];
  stored: Map<string, AiStoredMessageState>;
  nextPosition: number;
}

interface AiModelCall {
  model: string;
  usage: AiModelCallUsage;
  reportedCostUsd: number | null;
}

interface AiRequestSpending {
  calls: AiModelCall[];
  toolNames: string[];
}

interface AiRequestState {
  requestId: string;
  organizationId: string;
  userId: string;
  period: AiAssistantUsagePeriod;
  /** Whether this request took an action from the allowance; only new messages do. */
  reserved: boolean;
  /** A confirmation that may run what was confirmed but not propose anything new. */
  blockNewProposals: boolean;
  startedAt: number;
}

/**
 * ChurchFlow AI, independent of the channel it is reached through. The web controller streams
 * what this returns; another channel only has to resolve its user and organization and call the
 * same method, and gets the same permissions, allowance and confirmations.
 */
@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly repository: AiAssistantRepository,
    private readonly entitlementsService: EntitlementsService,
    private readonly auditService: AuditService,
    private readonly modelProvider: AiModelProvider,
    private readonly membershipsService: MembershipsService,
    private readonly groupsService: GroupsService,
    private readonly calendarEventsService: CalendarEventsService,
    private readonly prayerRequestsService: PrayerRequestsService,
    private readonly budgetsService: BudgetsService,
    private readonly knowledgeEntriesService: KnowledgeEntriesService,
    private readonly importantDatesService: ImportantDatesService,
  ) {}

  async usage(userId: string, organizationId: string): Promise<AiAssistantUsagePayload> {
    this.assertEnabled();
    const access = await assertOrganizationAccess(this.prisma, { userId, organizationId });
    const period = await this.requireUsagePeriod(organizationId, new Date());

    return {
      used: await this.repository.findUsage(organizationId, period.start),
      limit: this.actionLimit(),
      periodEndsAt: period.end.toISOString(),
      canViewCounter: canViewUsageCounter(access),
    };
  }

  async conversations(
    userId: string,
    organizationId: string,
  ): Promise<AiAssistantConversationsPayload> {
    this.assertEnabled();
    await assertOrganizationAccess(this.prisma, { userId, organizationId });
    const conversations = await this.repository.listConversations(organizationId, userId);

    return {
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt.toISOString(),
      })),
    };
  }

  async conversationMessages(
    userId: string,
    organizationId: string,
    conversationId: string,
  ): Promise<{ messages: UIMessage[] }> {
    this.assertEnabled();
    await assertOrganizationAccess(this.prisma, { userId, organizationId });
    await this.requireOwnConversation(conversationId, userId, organizationId);

    return { messages: (await this.loadHistory(conversationId, undefined)).messages };
  }

  /** One organization's AI consumption in a billing period, for platform admins only. */
  async adminUsageReport(
    organizationId: string,
    query: AiAssistantAdminUsageQuery,
  ): Promise<AiAssistantAdminUsageReport> {
    if (!(await this.repository.organizationExists(organizationId))) {
      throw new NotFoundException('Organization was not found');
    }

    const period = query.periodStart
      ? { start: new Date(query.periodStart), end: addMonths(new Date(query.periodStart), 1) }
      : reportingPeriod({
          subscription: await this.repository.findSubscriptionState(organizationId),
          enforcementEnabled: this.entitlementsService.isEnforcementEnabled(),
          now: new Date(),
        });
    const [report, history, actionsUsed] = await Promise.all([
      this.repository.usageReport(organizationId, period.start),
      this.repository.usageHistory(organizationId),
      this.repository.findUsage(organizationId, period.start),
    ]);
    const actionsByPeriod = new Map(
      history.counters.map((counter) => [counter.periodStart.toISOString(), counter.used]),
    );

    return {
      organizationId,
      periodStart: period.start.toISOString(),
      periodEnd: period.end.toISOString(),
      actionsUsed,
      actionsLimit: this.actionLimit(),
      requests: report.requests,
      callsWithoutCost: report.unknownCost,
      ...tokenTotals(report.totals._count, report.totals._sum),
      byModel: report.byModel.map((row) => ({
        provider: row.provider,
        model: row.model,
        ...tokenTotals(row._count, row._sum),
      })),
      history: history.periods.map((row) => ({
        periodStart: row.billingPeriodStart.toISOString(),
        actionsUsed: actionsByPeriod.get(row.billingPeriodStart.toISOString()) ?? 0,
        totalTokens: row._sum.totalTokens ?? 0,
        estimatedCostUsd: usdString(row._sum.costUsd),
      })),
    };
  }

  async chat(input: AiChatInput): Promise<ReadableStream<UIMessageChunk>> {
    this.assertEnabled();
    const { userId, organizationId, request, channel } = input;
    const now = input.now ?? new Date();
    const access = await assertOrganizationAccess(this.prisma, { userId, organizationId });
    const period = await this.requireUsagePeriod(organizationId, now);

    const existing = await this.repository.findConversation(request.conversationId);
    if (existing && (existing.userId !== userId || existing.organizationId !== organizationId)) {
      throw new NotFoundException('Conversation was not found');
    }
    if (!existing) {
      if (!request.message) throw new NotFoundException('Conversation was not found');
      await this.repository.createConversation({
        id: request.conversationId,
        organizationId,
        userId,
        channel,
        title: request.message.text.slice(0, CONVERSATION_TITLE_MAX_LENGTH),
      });
    }

    let state: AiRequestState;
    try {
      state = await this.startRequest(input, period);
    } catch (error) {
      // A refused first message must not leave an empty chat behind in the history.
      if (!existing)
        await this.repository.deleteConversationWithoutMessages(request.conversationId);
      throw error;
    }
    try {
      return await this.stream(input, access, state, now);
    } catch (error) {
      await this.failRequest(state, error instanceof HttpException ? error : null);
      throw error;
    }
  }

  private async startRequest(
    input: AiChatInput,
    period: AiAssistantUsagePeriod,
  ): Promise<AiRequestState> {
    const { userId, organizationId, request, channel } = input;
    const [firstApproval] = request.approvals ?? [];
    const actionRequestId = firstApproval
      ? await this.repository.findProposingRequestId(
          request.conversationId,
          firstApproval.approvalId,
        )
      : null;
    const confirmationsSoFar = actionRequestId
      ? await this.repository.countConfirmations(actionRequestId)
      : 0;
    if (confirmationsSoFar >= AI_ASSISTANT_MAX_CONFIRMATIONS_PER_ACTION) {
      throw new ConflictException({
        code: AI_ASSISTANT_CONFIRMATION_LIMIT_ERROR_CODE,
        message: 'This action has had all its confirmations; send a new message to continue',
      });
    }
    let requestId: string;
    try {
      requestId = await this.repository.startRequest({
        organizationId,
        userId,
        conversationId: request.conversationId,
        clientMessageId: request.message?.id ?? null,
        actionRequestId,
        kind: request.message ? 'MESSAGE' : 'APPROVAL',
        channel,
        provider: this.modelProvider.providerName,
        model: this.modelProvider.modelId,
        billingPeriodStart: period.start,
      });
    } catch (error) {
      if (error instanceof DuplicateAiRequestError) {
        throw new ConflictException({
          code: AI_ASSISTANT_DUPLICATE_MESSAGE_ERROR_CODE,
          message: 'This message was already sent',
        });
      }

      throw error;
    }

    const state: AiRequestState = {
      requestId,
      organizationId,
      userId,
      period,
      reserved: false,
      blockNewProposals: false,
      startedAt: Date.now(),
    };
    // A confirmation continues an action already paid for; only a new message costs one. It may
    // not open another round when this is the action's last one, or when the allowance is spent.
    if (!request.message) {
      const lastConfirmation = confirmationsSoFar + 1 >= AI_ASSISTANT_MAX_CONFIRMATIONS_PER_ACTION;
      const allowanceSpent =
        (await this.repository.findUsage(organizationId, period.start)) >= this.actionLimit();

      return { ...state, blockNewProposals: lastConfirmation || allowanceSpent };
    }

    const reserved = await this.repository.reserveAction(
      organizationId,
      period.start,
      this.actionLimit(),
    );
    if (!reserved) {
      const error = new HttpException(
        {
          code: AI_ASSISTANT_QUOTA_EXHAUSTED_ERROR_CODE,
          message: 'This organization has used all ChurchFlow AI actions for this billing period',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
      await this.failRequest(state, error);
      throw error;
    }

    return { ...state, reserved: true };
  }

  private async stream(
    input: AiChatInput,
    access: OrganizationAccess,
    state: AiRequestState,
    now: Date,
  ): Promise<ReadableStream<UIMessageChunk>> {
    const { userId, organizationId, request } = input;
    const conversationId = request.conversationId;
    const [storedLocale, organizationName] = await Promise.all([
      this.repository.findUserLocale(userId),
      this.repository.findOrganizationName(organizationId),
    ]);
    const locale = appLocaleOrFallback(storedLocale);
    const timeZone = request.uiContext.timeZone
      ? validTimeZoneOrFallback(request.uiContext.timeZone)
      : BILLING_TIME_ZONE;

    const services = {
      membershipsService: this.membershipsService,
      groupsService: this.groupsService,
      calendarEventsService: this.calendarEventsService,
      prayerRequestsService: this.prayerRequestsService,
      budgetsService: this.budgetsService,
      knowledgeEntriesService: this.knowledgeEntriesService,
      importantDatesService: this.importantDatesService,
    };
    // Filled once the stored history is loaded; the tools that validate it need the runner first.
    const confirmedApprovals = new Map<string, string>();
    const runner = new AiToolRunner(
      {
        prisma: this.prisma,
        entitlementsService: this.entitlementsService,
        repository: this.repository,
        auditService: this.auditService,
      },
      {
        organizationId,
        userId,
        conversationId,
        requestId: state.requestId,
        confirmedApprovals,
        locale,
        timeZone,
        now,
      },
    );
    const names = new AiNameResolver(organizationId, userId, services);
    const tools = buildAiToolSet(runner, services);

    const history = await this.loadHistory(conversationId, tools);
    for (const [toolCallId, approvalId] of confirmedApprovalIds(
      request.approvals ?? [],
      history.messages,
    )) {
      confirmedApprovals.set(toolCallId, approvalId);
    }
    const retried = request.message ? retriedAttempt(history.messages, request.message.id) : null;
    const messages = request.message
      ? [
          ...(retried?.before ?? history.messages),
          {
            id: request.message.id,
            role: 'user' as const,
            parts: [{ type: 'text' as const, text: request.message.text }],
          },
        ]
      : await this.applyApprovals(
          history.messages,
          request.approvals ?? [],
          conversationId,
          userId,
        );

    const pendingGroups = pendingToolGroups(messages);
    const initialGroups = initialToolGroups({
      module: request.uiContext.module,
      text: request.message?.text ?? null,
      pendingGroups,
    });
    const [currentGroup, currentMember] = await this.resolveUiContext(request.uiContext, names);

    const spent: AiRequestSpending = {
      calls: [],
      // Tools confirmed in this request run before its first step, so no step reports them.
      toolNames: approvedToolNames(messages),
    };
    let producedOutput = false;
    let finished = false;
    // onError, onAbort and onEnd can overlap; the first outcome is the one recorded.
    const finishOnce = async (finish: () => Promise<void>) => {
      if (finished) return;
      finished = true;
      await finish();
    };
    const failStream = async (reason: string, error: unknown) => {
      this.logger.error({
        event: 'AI assistant request failed',
        requestId: state.requestId,
        reason,
        message: error instanceof Error ? error.message : null,
      });
      // Once the user has seen part of an answer the action was spent; before that it is refunded.
      await finishOnce(() => this.failRequest(state, null, { counted: producedOutput, spent }));
    };
    const result = streamText({
      model: this.modelProvider.languageModel(),
      instructions: buildAssistantInstructions({
        organizationName: organizationName ?? 'ChurchFlow',
        role: access.role,
        locale,
        timeZone,
        now,
        module: request.uiContext.module,
        currentGroup,
        currentMember,
      }),
      // A reply stopped mid-tool is saved with a call that never got a result; replaying such a
      // call would make every later message in the conversation fail.
      messages: await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
      tools,
      toolApproval: buildToolApproval(runner, names, {
        blockNewProposals: state.blockNewProposals,
        confirmedToolCallIds: confirmedToolCallIds(messages),
      }),
      activeTools: toolsInGroups(initialGroups, access.role),
      prepareStep: ({ steps }) => ({
        activeTools: toolsInGroups([...initialGroups, ...enabledToolGroups(steps)], access.role),
      }),
      stopWhen: isStepCount(
        request.message
          ? this.configService.getOrThrow<number>('AI_MAX_STEPS')
          : AI_ASSISTANT_CONFIRMATION_MAX_STEPS,
      ),
      timeout: { totalMs: this.configService.getOrThrow<number>('AI_REQUEST_TIMEOUT_MS') },
      maxRetries: 1,
      onChunk: ({ chunk }) => {
        if (OUTPUT_CHUNK_TYPES.has(chunk.type)) producedOutput = true;
      },
      // Every model call is recorded with what the provider reported for it, never estimated.
      onStepEnd: (step) => {
        spent.calls.push({
          model: step.model.modelId,
          usage: {
            inputTokens: step.usage.inputTokens,
            cachedInputTokens: step.usage.inputTokenDetails.cacheReadTokens,
            outputTokens: step.usage.outputTokens,
            reasoningTokens: step.usage.outputTokenDetails.reasoningTokens,
            totalTokens: step.usage.totalTokens,
          },
          reportedCostUsd: reportedCostUsd(step.providerMetadata),
        });
        spent.toolNames.push(...step.toolCalls.map((call) => call.toolName));
      },
      onError: ({ error }) => failStream('error', error),
      onAbort: ({ reason }) => failStream('abort', reason),
      onEnd: () =>
        finishOnce(() =>
          this.recordFinish(
            state,
            { status: 'SUCCEEDED', countedAgainstQuota: state.reserved, errorCode: null },
            spent,
          ),
        ),
    });
    const uiStream = toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: messages,
      generateMessageId: randomUUID,
      onError: () => PROVIDER_ERROR_MESSAGE,
      // The card and the row that lets it be confirmed are written together, or not at all.
      onEnd: ({ messages: finalMessages, responseMessage }) =>
        this.saveTurn(
          state.requestId,
          conversationId,
          planTurnWrites({
            stored: history.stored,
            nextPosition: history.nextPosition,
            messages: finalMessages.map((message) => ({
              clientId: message.id,
              role: message.role,
              parts: jsonFromUnknown(message.parts) ?? [],
            })),
            replacedClientIds: retried?.replacedClientIds ?? [],
          }),
          pendingExecutions(responseMessage, {
            organizationId,
            userId,
            conversationId,
            requestId: state.requestId,
          }),
        ),
    });
    // The client may leave mid-reply - Stop, a new chat, a closed panel - while the model and the
    // confirmed tools keep going. The server reads its own copy of the stream to the end, so the
    // turn is saved when it is really over, not when the client stopped listening.
    const [clientStream, serverStream] = uiStream.tee();
    void drainStream(serverStream).catch((error: unknown) => {
      this.logger.error({
        event: 'AI assistant stream could not be completed',
        requestId: state.requestId,
        message: error instanceof Error ? error.message : null,
      });
    });

    return clientStream;
  }

  private async saveTurn(
    requestId: string,
    ...turn: Parameters<AiAssistantRepository['saveTurn']>
  ): Promise<void> {
    try {
      await this.repository.saveTurn(...turn);
    } catch (error) {
      this.logger.error({
        event: 'AI assistant turn could not be saved',
        requestId,
        message: error instanceof Error ? error.message : null,
      });
    }
  }

  /**
   * Answers the confirmation cards of the last reply. Only calls that are still waiting can be
   * answered, so replaying a confirmation - or inventing one - never reaches a tool.
   */
  private async applyApprovals(
    history: UIMessage[],
    decisions: AiAssistantApprovalDecision[],
    conversationId: string,
    userId: string,
  ): Promise<UIMessage[]> {
    const last = history.at(-1);
    if (!last || last.role !== 'assistant') {
      throw new ConflictException('There is nothing waiting for confirmation');
    }

    const pending = new Set(
      last.parts.flatMap((part) =>
        isToolUIPart(part) && part.state === 'approval-requested' ? [part.approval.id] : [],
      ),
    );
    if (decisions.some((decision) => !pending.has(decision.approvalId))) {
      throw new ConflictException('This action is no longer waiting for confirmation');
    }

    const decided = new Map(decisions.map((decision) => [decision.approvalId, decision.approved]));
    const parts = last.parts.map((part) => {
      if (!isToolUIPart(part) || part.state !== 'approval-requested') return part;
      const approved = decided.get(part.approval.id);
      if (approved === undefined) return part;

      return {
        ...part,
        state: 'approval-responded' as const,
        approval: { ...part.approval, approved },
      };
    });

    await Promise.all(
      decisions
        .filter((decision) => !decision.approved)
        .map((decision) =>
          this.repository.rejectPendingExecution({
            conversationId,
            approvalId: decision.approvalId,
            decidedByUserId: userId,
          }),
        ),
    );

    return [...history.slice(0, -1), { ...last, parts }];
  }

  /**
   * The stored conversation, validated message by message. A message an older tool schema no
   * longer accepts is left out of what the model sees but kept in storage, so one outdated part
   * never costs the rest of the history.
   */
  private async loadHistory(
    conversationId: string,
    tools: AiToolSet | undefined,
  ): Promise<AiConversationHistory> {
    const stored = await this.repository.listMessages(conversationId);
    const messages: UIMessage[] = [];
    const states = new Map<string, AiStoredMessageState>();
    let skipped = 0;

    for (const row of stored) {
      const validated = await safeValidateUIMessages<UIMessage>({
        messages: [{ id: row.clientId, role: row.role, parts: row.parts }],
        ...(tools ? { tools } : {}),
      });
      const [message] = validated.success ? validated.data : [];
      if (!message) {
        skipped += 1;
        continue;
      }

      messages.push(message);
      states.set(row.clientId, { position: row.position, fingerprint: stableJson(row.parts) });
    }

    if (skipped > 0) {
      this.logger.warn({
        event: 'AI conversation messages failed validation',
        conversationId,
        skipped,
      });
    }

    return {
      messages,
      stored: states,
      nextPosition: stored.reduce((max, row) => Math.max(max, row.position + 1), 0),
    };
  }

  private async resolveUiContext(
    uiContext: AiAssistantUiContext,
    names: AiNameResolver,
  ): Promise<[{ id: string; name: string } | null, { id: string; name: string } | null]> {
    const [groupName, memberName] = await Promise.all([
      uiContext.groupId ? names.groupName(uiContext.groupId) : null,
      uiContext.membershipId ? names.memberName(uiContext.membershipId) : null,
    ]);

    return [
      uiContext.groupId && groupName ? { id: uiContext.groupId, name: groupName } : null,
      uiContext.membershipId && memberName
        ? { id: uiContext.membershipId, name: memberName }
        : null,
    ];
  }

  private async requireOwnConversation(
    conversationId: string,
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const conversation = await this.repository.findConversation(conversationId);
    if (
      !conversation ||
      conversation.userId !== userId ||
      conversation.organizationId !== organizationId
    ) {
      throw new NotFoundException('Conversation was not found');
    }
  }

  private async requireUsagePeriod(
    organizationId: string,
    now: Date,
  ): Promise<AiAssistantUsagePeriod> {
    const decision = resolveAiAssistantAccess({
      subscription: await this.repository.findSubscriptionState(organizationId),
      enforcementEnabled: this.entitlementsService.isEnforcementEnabled(),
      now,
    });
    if (!decision.allowed) {
      throw new ForbiddenException({
        code: AI_ASSISTANT_UNAVAILABLE_ERROR_CODE,
        message: 'ChurchFlow AI is available to organizations with an active subscription',
      });
    }

    return decision.period;
  }

  private async failRequest(
    state: AiRequestState,
    error: HttpException | null,
    options: { counted?: boolean; spent?: AiRequestSpending } = {},
  ): Promise<void> {
    const counted = options.counted === true && state.reserved;
    if (state.reserved && !counted) {
      await this.repository.releaseAction(state.organizationId, state.period.start);
    }

    await this.recordFinish(
      state,
      {
        status: 'FAILED',
        countedAgainstQuota: counted,
        errorCode: error ? errorCode(error) : 'PROVIDER_ERROR',
      },
      options.spent ?? { calls: [], toolNames: [] },
    );
  }

  /**
   * Telemetry is written after the answer, and a failure to write it is logged, never passed on:
   * the user already has the reply, and losing one row is better than failing a finished stream.
   * The allowance is not part of this - it is reserved and refunded on its own, before.
   */
  private async recordFinish(
    state: AiRequestState,
    outcome: Pick<AiRequestFinish, 'status' | 'countedAgainstQuota' | 'errorCode'>,
    spent: AiRequestSpending,
  ): Promise<void> {
    const provider = this.modelProvider.providerName;
    const startedAt = new Date(state.startedAt);
    try {
      await this.repository.finishRequest(
        state.requestId,
        { ...outcome, toolNames: spent.toolNames, latencyMs: Date.now() - state.startedAt },
        spent.calls.map((call, stepIndex) => ({
          organizationId: state.organizationId,
          userId: state.userId,
          stepIndex,
          provider,
          model: call.model,
          billingPeriodStart: state.period.start,
          inputTokens: call.usage.inputTokens ?? null,
          cachedInputTokens: call.usage.cachedInputTokens ?? null,
          outputTokens: call.usage.outputTokens ?? null,
          reasoningTokens: call.usage.reasoningTokens ?? null,
          totalTokens: call.usage.totalTokens ?? null,
          ...modelCallCost({
            usage: call.usage,
            reportedCostUsd: call.reportedCostUsd,
            price: findModelPrice(AI_MODEL_PRICES, provider, call.model, startedAt),
            at: startedAt,
          }),
        })),
      );
    } catch (error) {
      this.logger.error({
        event: 'AI request telemetry could not be recorded',
        requestId: state.requestId,
        message: error instanceof Error ? error.message : null,
      });
    }
  }

  private assertEnabled(): void {
    if (!this.configService.getOrThrow<boolean>('AI_ASSISTANT_ENABLED')) {
      throw new NotFoundException('ChurchFlow AI is not enabled');
    }
  }

  private actionLimit(): number {
    return this.configService.getOrThrow<number>('AI_MONTHLY_ACTION_LIMIT');
  }
}

/** A retried message takes the place of its failed attempt and whatever answer that left. */
function retriedAttempt(
  history: UIMessage[],
  messageId: string,
): { before: UIMessage[]; replacedClientIds: string[] } | null {
  const index = history.findIndex((message) => message.id === messageId);
  if (index === -1) return null;

  return {
    before: history.slice(0, index),
    replacedClientIds: history.slice(index).map((message) => message.id),
  };
}

const COST_DECIMAL_PLACES = 6;

function usdString(value: Prisma.Decimal | null): string {
  return (value ?? new Prisma.Decimal(0)).toDecimalPlaces(COST_DECIMAL_PLACES).toFixed();
}

function tokenTotals(
  modelCalls: number,
  sum: {
    inputTokens: number | null;
    cachedInputTokens: number | null;
    outputTokens: number | null;
    reasoningTokens: number | null;
    totalTokens: number | null;
    costUsd: Prisma.Decimal | null;
  },
): AiAssistantTokenTotals {
  return {
    modelCalls,
    inputTokens: sum.inputTokens ?? 0,
    cachedInputTokens: sum.cachedInputTokens ?? 0,
    outputTokens: sum.outputTokens ?? 0,
    reasoningTokens: sum.reasoningTokens ?? 0,
    totalTokens: sum.totalTokens ?? 0,
    estimatedCostUsd: usdString(sum.costUsd),
  };
}

async function drainStream(stream: ReadableStream<unknown>): Promise<void> {
  const reader = stream.getReader();
  for (;;) {
    const { done } = await reader.read();
    if (done) return;
  }
}

function canViewUsageCounter(access: OrganizationAccess): boolean {
  return access.platformAdmin || access.role === 'OWNER' || access.role === 'ADMIN';
}

function errorCode(error: HttpException): string {
  const response = error.getResponse();
  if (typeof response === 'object' && 'code' in response) {
    const { code } = response;
    if (typeof code === 'string') return code;
  }

  return `HTTP_${String(error.getStatus())}`;
}

/**
 * The approvals the user granted in this request, by the call they answer. Taken from the stored
 * history, not from the client, so a request can only confirm cards the assistant really showed.
 */
function confirmedApprovalIds(
  decisions: AiAssistantApprovalDecision[],
  history: UIMessage[],
): ReadonlyMap<string, string> {
  const approved = new Set(
    decisions.filter((decision) => decision.approved).map((decision) => decision.approvalId),
  );
  const last = history.at(-1);
  if (!last || last.role !== 'assistant') return new Map();

  return new Map(
    last.parts.flatMap((part) =>
      isToolUIPart(part) && part.state === 'approval-requested' && approved.has(part.approval.id)
        ? [[part.toolCallId, part.approval.id] as const]
        : [],
    ),
  );
}

/** Calls the user answered in this request; the only ones it may still run when proposals are blocked. */
function confirmedToolCallIds(messages: UIMessage[]): ReadonlySet<string> {
  const last = messages.at(-1);
  if (!last || last.role !== 'assistant') return new Set();

  return new Set(
    last.parts.flatMap((part) =>
      isToolUIPart(part) && part.state === 'approval-responded' ? [part.toolCallId] : [],
    ),
  );
}

/** Tools the user confirmed in this request; they run before the model is called again. */
function approvedToolNames(messages: UIMessage[]): string[] {
  const last = messages.at(-1);
  if (!last || last.role !== 'assistant') return [];

  return last.parts.flatMap((part) =>
    isToolUIPart(part) && part.state === 'approval-responded' && part.approval.approved
      ? [getToolName(part)]
      : [],
  );
}

/** Groups the model asked for with enableToolGroups in earlier steps of this request. */
function enabledToolGroups(
  steps: readonly { toolCalls: readonly { toolName: string; input: unknown }[] }[],
) {
  return steps.flatMap((step) =>
    step.toolCalls.flatMap((call) => {
      if (call.toolName !== 'enableToolGroups') return [];
      const parsed = enableToolGroupsInputSchema.safeParse(call.input);

      return parsed.success ? parsed.data.groups : [];
    }),
  );
}

/** Tool groups a pending confirmation belongs to, so its tool is loaded when it is answered. */
function pendingToolGroups(messages: UIMessage[]): AiToolGroup[] {
  const last = messages.at(-1);
  if (!last || last.role !== 'assistant') return [];

  return last.parts.flatMap((part) => {
    if (!isToolUIPart(part) || part.state !== 'approval-responded') return [];
    const group = toolGroupOf(getToolName(part));

    return group ? [group] : [];
  });
}

function pendingExecutions(
  message: UIMessage,
  context: { organizationId: string; userId: string; conversationId: string; requestId: string },
): AiPendingToolExecution[] {
  return message.parts.flatMap((part) => {
    if (!isToolUIPart(part) || part.state !== 'approval-requested') return [];
    const toolName = getToolName(part);
    const meta = Object.values(AI_TOOL_META).find((candidate) => candidate.name === toolName);
    if (!meta) return [];

    return [
      {
        ...context,
        toolCallId: part.toolCallId,
        toolName,
        risk: meta.risk,
        input: jsonFromUnknown(part.input) ?? {},
        approvalId: part.approval.id,
      },
    ];
  });
}
