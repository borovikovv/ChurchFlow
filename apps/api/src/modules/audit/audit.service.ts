import { Injectable } from '@nestjs/common';
import type { AuditAction, Prisma } from '@churchflow/db';
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
    metadata?: Prisma.InputJsonObject;
  }): Promise<void> {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      action: input.action,
      entityType: input.entityType,
      metadata: input.metadata ?? {}
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

    await this.prisma.auditLog.create({
      data
    });
  }
}
