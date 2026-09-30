import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type AiCostSource,
  type AiRequestKind,
  type AiRequestStatus,
  type AiToolExecutionStatus,
  type AiToolRisk,
} from '@churchflow/db';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AiAssistantSubscriptionState } from '../ai-assistant-access';
import type { AiTurnWrites } from '../ai-conversation-history';

const CONVERSATION_LIST_LIMIT = 20;

export interface AiConversationOwner {
  id: string;
  organizationId: string;
  userId: string;
}

export interface AiStoredMessage {
  clientId: string;
  role: string;
  position: number;
  parts: Prisma.JsonValue;
}

export interface AiRequestStart {
  organizationId: string;
  userId: string;
  conversationId: string;
  clientMessageId: string | null;
  actionRequestId: string | null;
  kind: AiRequestKind;
  channel: string;
  provider: string;
  model: string;
  billingPeriodStart: Date;
}

export interface AiRequestFinish {
  status: AiRequestStatus;
  countedAgainstQuota: boolean;
  toolNames: string[];
  latencyMs: number;
  errorCode: string | null;
}

export interface AiModelUsageRecord {
  organizationId: string;
  userId: string;
  stepIndex: number;
  provider: string;
  model: string;
  billingPeriodStart: Date;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  costUsd: Prisma.Decimal | null;
  costSource: AiCostSource;
  pricingVersion: string | null;
}

const USAGE_SUM_FIELDS = {
  inputTokens: true,
  cachedInputTokens: true,
  outputTokens: true,
  reasoningTokens: true,
  totalTokens: true,
  costUsd: true,
} as const;

const USAGE_HISTORY_PERIODS = 12;

export interface AiPendingToolExecution {
  organizationId: string;
  userId: string;
  conversationId: string;
  requestId: string;
  toolCallId: string;
  toolName: string;
  risk: AiToolRisk;
  input: Prisma.InputJsonValue;
  approvalId: string;
}

export class DuplicateAiRequestError extends Error {
  constructor() {
    super('This message was already sent');
  }
}

@Injectable()
export class AiAssistantRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSubscriptionState(organizationId: string): Promise<AiAssistantSubscriptionState | null> {
    return this.prisma.subscription.findUnique({
      where: { organizationId },
      select: { status: true, isExempt: true, currentPeriodEndsAt: true },
    });
  }

  async findUserLocale(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });

    return user?.locale ?? null;
  }

  async findOrganizationName(organizationId: string): Promise<string | null> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    return organization?.name ?? null;
  }

  async findUsage(organizationId: string, periodStart: Date): Promise<number> {
    const counter = await this.prisma.aiUsageCounter.findUnique({
      where: { organizationId_periodStart: { organizationId, periodStart } },
      select: { used: true },
    });

    return counter?.used ?? 0;
  }

  /**
   * Takes one action from the allowance, or reports that none is left. The increment is a single
   * conditional UPDATE, which Postgres re-checks after taking the row lock, so two messages racing
   * for the last action cannot both win it.
   */
  async reserveAction(organizationId: string, periodStart: Date, limit: number): Promise<boolean> {
    await this.prisma.aiUsageCounter.createMany({
      data: [{ organizationId, periodStart, used: 0 }],
      skipDuplicates: true,
    });
    const reserved = await this.prisma.aiUsageCounter.updateMany({
      where: { organizationId, periodStart, used: { lt: limit } },
      data: { used: { increment: 1 } },
    });

    return reserved.count === 1;
  }

  async releaseAction(organizationId: string, periodStart: Date): Promise<void> {
    await this.prisma.aiUsageCounter.updateMany({
      where: { organizationId, periodStart, used: { gt: 0 } },
      data: { used: { decrement: 1 } },
    });
  }

  findConversation(conversationId: string): Promise<AiConversationOwner | null> {
    return this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, organizationId: true, userId: true },
    });
  }

  /** Creates the conversation unless a concurrent request for the same new chat already did. */
  async createConversation(input: {
    id: string;
    organizationId: string;
    userId: string;
    channel: string;
    title: string;
  }): Promise<void> {
    await this.prisma.aiConversation.createMany({ data: [input], skipDuplicates: true });
  }

  listConversations(organizationId: string, userId: string) {
    return this.prisma.aiConversation.findMany({
      where: { organizationId, userId },
      orderBy: { updatedAt: 'desc' },
      take: CONVERSATION_LIST_LIMIT,
      select: { id: true, title: true, updatedAt: true },
    });
  }

  listMessages(conversationId: string): Promise<AiStoredMessage[]> {
    return this.prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { clientId: true, role: true, position: true, parts: true },
    });
  }

  /**
   * Stores one turn - the messages that are new or changed, the attempt a retry replaced, and the
   * confirmations the reply is waiting for - in one transaction, so a confirmation card is never
   * saved without the row that lets it be confirmed.
   */
  async saveTurn(
    conversationId: string,
    writes: AiTurnWrites,
    pendingExecutions: AiPendingToolExecution[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.aiMessage.deleteMany({
        where: { conversationId, clientId: { in: writes.removedClientIds } },
      }),
      ...writes.upserts.map(({ position, ...message }) =>
        this.prisma.aiMessage.upsert({
          where: { conversationId_clientId: { conversationId, clientId: message.clientId } },
          create: { conversationId, position, ...message },
          update: { position, role: message.role, parts: message.parts },
          select: { id: true },
        }),
      ),
      this.prisma.aiToolExecution.createMany({
        data: pendingExecutions.map((execution) => ({
          ...execution,
          status: 'PENDING_APPROVAL' as const,
        })),
        skipDuplicates: true,
      }),
      this.prisma.aiConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
        select: { id: true },
      }),
    ]);
  }

  async deleteConversationWithoutMessages(conversationId: string): Promise<void> {
    await this.prisma.aiConversation.deleteMany({
      where: { id: conversationId, messages: { none: {} } },
    });
  }

  async startRequest(input: AiRequestStart): Promise<string> {
    try {
      const request = await this.prisma.aiRequest.create({ data: input, select: { id: true } });
      return request.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DuplicateAiRequestError();
      }

      throw error;
    }
  }

  /**
   * Closes a request together with the model calls it made. The (requestId, stepIndex) key makes
   * a repeated write of the same call a no-op, so a retried finish never counts tokens twice.
   */
  async finishRequest(
    requestId: string,
    input: AiRequestFinish,
    modelUsage: AiModelUsageRecord[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.aiRequest.update({
        where: { id: requestId },
        data: {
          ...input,
          toolCallCount: input.toolNames.length,
          finishedAt: new Date(),
          // A failed message may be sent again under the same id; only an answered one is a duplicate.
          ...(input.status === 'FAILED' ? { clientMessageId: null } : {}),
        },
        select: { id: true },
      }),
      this.prisma.aiModelUsage.createMany({
        data: modelUsage.map((usage) => ({ ...usage, requestId })),
        skipDuplicates: true,
      }),
    ]);
  }

  countConfirmations(actionRequestId: string): Promise<number> {
    return this.prisma.aiRequest.count({ where: { actionRequestId, kind: 'APPROVAL' } });
  }

  /** The message whose proposal a confirmation answers, so both count as one action. */
  async findProposingRequestId(conversationId: string, approvalId: string): Promise<string | null> {
    const execution = await this.prisma.aiToolExecution.findFirst({
      where: { conversationId, approvalId },
      select: { requestId: true, request: { select: { actionRequestId: true } } },
    });

    return execution?.request?.actionRequestId ?? execution?.requestId ?? null;
  }

  async organizationExists(organizationId: string): Promise<boolean> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    return organization !== null;
  }

  /** Tokens and cost of one organization in one billing period, in total and per model. */
  async usageReport(organizationId: string, billingPeriodStart: Date) {
    const where = { organizationId, billingPeriodStart };
    const [totals, byModel, unknownCost, requests] = await Promise.all([
      this.prisma.aiModelUsage.aggregate({ where, _sum: USAGE_SUM_FIELDS, _count: true }),
      this.prisma.aiModelUsage.groupBy({
        by: ['provider', 'model'],
        where,
        _sum: USAGE_SUM_FIELDS,
        _count: true,
        orderBy: [{ provider: 'asc' }, { model: 'asc' }],
      }),
      this.prisma.aiModelUsage.count({ where: { ...where, costSource: 'UNKNOWN' } }),
      this.prisma.aiRequest.count({ where }),
    ]);

    return { totals, byModel, unknownCost, requests };
  }

  /** The latest billing periods of one organization, newest first. */
  async usageHistory(organizationId: string) {
    const [periods, counters] = await Promise.all([
      this.prisma.aiModelUsage.groupBy({
        by: ['billingPeriodStart'],
        where: { organizationId },
        _sum: { totalTokens: true, costUsd: true },
        orderBy: { billingPeriodStart: 'desc' },
        take: USAGE_HISTORY_PERIODS,
      }),
      this.prisma.aiUsageCounter.findMany({
        where: { organizationId },
        orderBy: { periodStart: 'desc' },
        take: USAGE_HISTORY_PERIODS,
        select: { periodStart: true, used: true },
      }),
    ]);

    return { periods, counters };
  }

  async recordToolExecution(input: {
    organizationId: string;
    userId: string;
    conversationId: string;
    requestId: string;
    toolCallId: string;
    toolName: string;
    risk: AiToolRisk;
    input: Prisma.InputJsonValue;
    status: AiToolExecutionStatus;
    resultSummary: string | null;
    errorMessage: string | null;
  }): Promise<void> {
    await this.prisma.aiToolExecution.createMany({ data: [input], skipDuplicates: true });
  }

  async rejectPendingExecution(input: {
    conversationId: string;
    approvalId: string;
    decidedByUserId: string;
  }): Promise<void> {
    await this.prisma.aiToolExecution.updateMany({
      where: {
        conversationId: input.conversationId,
        approvalId: input.approvalId,
        status: 'PENDING_APPROVAL',
      },
      data: { status: 'REJECTED', decidedByUserId: input.decidedByUserId, decidedAt: new Date() },
    });
  }

  /**
   * Moves the confirmed proposal out of PENDING_APPROVAL and returns its row. The proposal is found
   * by its approval id, never by the model's call id, which some models reuse; and exactly one
   * request can make the transition, so a confirmation that arrives twice runs the tool once.
   */
  async claimApprovedExecution(input: {
    conversationId: string;
    approvalId: string;
    requestId: string;
    decidedByUserId: string;
  }): Promise<string | null> {
    const claimed = await this.prisma.aiToolExecution.updateMany({
      where: {
        conversationId: input.conversationId,
        approvalId: input.approvalId,
        status: 'PENDING_APPROVAL',
      },
      data: {
        status: 'EXECUTING',
        requestId: input.requestId,
        decidedByUserId: input.decidedByUserId,
        decidedAt: new Date(),
      },
    });
    if (claimed.count !== 1) return null;

    const execution = await this.prisma.aiToolExecution.findUnique({
      where: {
        conversationId_approvalId: {
          conversationId: input.conversationId,
          approvalId: input.approvalId,
        },
      },
      select: { id: true },
    });

    return execution?.id ?? null;
  }

  async completeToolExecution(input: {
    executionId: string;
    status: 'SUCCEEDED' | 'FAILED';
    resultSummary: string | null;
    errorMessage: string | null;
  }): Promise<void> {
    await this.prisma.aiToolExecution.update({
      where: { id: input.executionId },
      data: {
        status: input.status,
        resultSummary: input.resultSummary,
        errorMessage: input.errorMessage,
      },
      select: { id: true },
    });
  }

  async purgeConversationsInactiveSince(cutoff: Date): Promise<number> {
    const deleted = await this.prisma.aiConversation.deleteMany({
      where: { updatedAt: { lt: cutoff } },
    });

    return deleted.count;
  }
}
