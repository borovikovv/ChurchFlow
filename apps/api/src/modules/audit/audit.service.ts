import { Injectable } from '@nestjs/common';
import type { AuditAction } from '@churchflow/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    organizationId?: string;
    actorUserId?: string;
    action: AuditAction;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ?? {}
      }
    });
  }
}
