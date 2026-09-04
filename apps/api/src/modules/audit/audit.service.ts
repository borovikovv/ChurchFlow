import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@churchflow/db';
import { BUDGET_AUDIT_ENTITY_TYPE } from '@churchflow/shared';
import type { AuditLogsPage, ListAuditLogsQuery } from '@churchflow/shared';
import { AuditRepository } from './repositories/audit.repository';

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async listForOrganization(
    organizationId: string,
    actorUserId: string,
    query: ListAuditLogsQuery,
  ): Promise<AuditLogsPage> {
    const actorMembership = await this.auditRepository.findOrganizationManager(
      organizationId,
      actorUserId,
    );

    if (!actorMembership) {
      throw new ForbiddenException('Only organization owners and admins can view audit logs');
    }

    const canReadBudgetHistory = actorMembership.role === 'OWNER';
    if (!canReadBudgetHistory && query.entityType === BUDGET_AUDIT_ENTITY_TYPE) {
      throw new ForbiddenException('Only organization owners can view budget audit logs');
    }

    const logs = await this.auditRepository.listForOrganization({
      organizationId,
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(canReadBudgetHistory ? {} : { excludedEntityTypes: [BUDGET_AUDIT_ENTITY_TYPE] }),
    });
    const items = logs.slice(0, query.limit);
    const next = logs.length > query.limit ? logs[query.limit] : null;

    return {
      items: items.map((log) => ({
        id: log.id,
        organizationId: log.organizationId,
        actorUserId: log.actorUserId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: this.toJsonObject(log.metadata),
        createdAt: log.createdAt.toISOString(),
        actor: log.actor,
      })),
      nextCursor: next?.id ?? null,
    };
  }

  async record(input: {
    organizationId?: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Prisma.InputJsonObject;
  }): Promise<void> {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      action: input.action,
      entityType: input.entityType,
      metadata: input.metadata ?? {},
    };

    if (input.organizationId !== undefined) {
      data.organizationId = input.organizationId;
    }

    if (input.actorUserId !== undefined) {
      data.actorUserId = input.actorUserId;
    }

    if (input.entityId !== undefined) {
      data.entityId = input.entityId;
    }

    await this.auditRepository.create(data);
  }

  private toJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
  }
}
