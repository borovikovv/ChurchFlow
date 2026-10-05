import type { Prisma } from '@churchflow/db';
import { assertOrganizationAccess } from '../../../common/guards/organization-access.guard';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { EntitlementsService } from '../../billing/entitlements.service';
import type { AiAssistantRepository } from '../repositories/ai-assistant.repository';
import {
  localized,
  toolErrorMessage,
  type AiToolContext,
  type AiToolMeta,
  type AiToolOutput,
} from './ai-tool';

export const AI_TOOL_EXECUTED_AUDIT_ACTION = 'AI_TOOL_EXECUTED';
export const AI_TOOL_EXECUTION_AUDIT_ENTITY_TYPE = 'AiToolExecution';

const SUMMARY_MAX_LENGTH = 500;

export interface AiToolRunnerDependencies {
  prisma: PrismaService;
  entitlementsService: EntitlementsService;
  repository: AiAssistantRepository;
  auditService: AuditService;
}

/**
 * Runs one request's tools with the requesting user's authority. Every call re-checks access
 * against the route the tool mirrors - membership, role, permission and subscription - instead of
 * trusting the check the chat request itself passed, because a confirmation can arrive long after
 * the role that allowed it was taken away.
 */
export class AiToolRunner {
  constructor(
    private readonly dependencies: AiToolRunnerDependencies,
    readonly context: AiToolContext,
  ) {}

  async authorize(meta: AiToolMeta): Promise<void> {
    const { organizationId, userId } = this.context;
    await assertOrganizationAccess(this.dependencies.prisma, {
      userId,
      organizationId,
      enforceMembershipRole: true,
      ...(meta.policy.ownerRequired ? { ownerRequired: true } : {}),
      ...(meta.policy.permission ? { permission: meta.policy.permission } : {}),
    });

    if (meta.policy.entitlement) {
      await this.dependencies.entitlementsService.assert(organizationId, meta.policy.entitlement);
    }
  }

  async read<TData>(
    meta: AiToolMeta,
    toolCallId: string,
    input: Prisma.InputJsonValue,
    run: () => Promise<AiToolOutput<TData>>,
  ): Promise<AiToolOutput<TData>> {
    let output: AiToolOutput<TData>;
    try {
      await this.authorize(meta);
      output = await run();
    } catch (error) {
      output = { ok: false, error: toolErrorMessage(error) };
    }

    await this.dependencies.repository.recordToolExecution({
      ...this.recordBase(meta, toolCallId, input),
      status: output.ok ? 'SUCCEEDED' : 'FAILED',
      resultSummary: output.ok ? truncate(output.summary) : null,
      errorMessage: output.ok ? null : truncate(output.error),
    });

    return output;
  }

  /**
   * Runs a confirmed mutation at most once. The proposal was recorded as PENDING_APPROVAL when
   * the model made it; claiming it is atomic, so a second delivery of the same confirmation finds
   * it already claimed and refuses instead of repeating it - or claiming another call's success.
   */
  async mutate<TData>(
    meta: AiToolMeta,
    toolCallId: string,
    run: () => Promise<AiToolOutput<TData>>,
  ): Promise<AiToolOutput<TData>> {
    const { repository, auditService } = this.dependencies;
    const { conversationId, organizationId, userId, requestId, locale } = this.context;

    // Only a call the user answered in this very request can run, and only its own proposal.
    const approvalId = this.context.confirmedApprovals.get(toolCallId);
    const executionId = approvalId
      ? await repository.claimApprovedExecution({
          conversationId,
          approvalId,
          requestId,
          decidedByUserId: userId,
        })
      : null;
    if (!executionId) {
      return {
        ok: false,
        error: localized(locale, {
          en: 'This action was already handled or is no longer awaiting confirmation.',
          uk: 'Цю дію вже оброблено або вона більше не очікує підтвердження.',
        }),
      };
    }

    let output: AiToolOutput<TData>;
    try {
      await this.authorize(meta);
      output = await run();
    } catch (error) {
      output = { ok: false, error: toolErrorMessage(error) };
    }

    await repository.completeToolExecution({
      executionId,
      status: output.ok ? 'SUCCEEDED' : 'FAILED',
      resultSummary: output.ok ? truncate(output.summary) : null,
      errorMessage: output.ok ? null : truncate(output.error),
    });

    if (output.ok) {
      await auditService.record({
        organizationId,
        actorUserId: userId,
        action: AI_TOOL_EXECUTED_AUDIT_ACTION,
        entityType: AI_TOOL_EXECUTION_AUDIT_ENTITY_TYPE,
        entityId: executionId,
        metadata: {
          toolName: meta.name,
          risk: meta.risk,
          conversationId,
          requestId,
          summary: truncate(output.summary),
        },
      });
    }

    return output;
  }

  private recordBase(meta: AiToolMeta, toolCallId: string, input: Prisma.InputJsonValue) {
    const { organizationId, userId, conversationId, requestId } = this.context;

    return {
      organizationId,
      userId,
      conversationId,
      requestId,
      toolCallId,
      toolName: meta.name,
      risk: meta.risk,
      input,
    };
  }
}

function truncate(value: string): string {
  return value.length > SUMMARY_MAX_LENGTH ? `${value.slice(0, SUMMARY_MAX_LENGTH - 1)}…` : value;
}
