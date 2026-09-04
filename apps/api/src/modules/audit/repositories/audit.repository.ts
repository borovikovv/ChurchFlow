import { Injectable } from '@nestjs/common';
import type { Prisma } from '@churchflow/db';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOrganizationManager(organizationId: string, actorUserId: string) {
    return this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: actorUserId,
        role: { in: ['OWNER', 'ADMIN'] },
        status: 'ACTIVE',
        removedAt: null,
        organization: {
          status: 'ACTIVE',
          deletedAt: null,
        },
      },
      select: { id: true, role: true },
    });
  }

  listForOrganization(input: {
    organizationId: string;
    cursor?: string;
    entityType?: string;
    excludedEntityTypes?: string[];
    limit: number;
  }) {
    return this.prisma.auditLog.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.entityType ? { entityType: input.entityType } : {}),
        ...(input.excludedEntityTypes?.length
          ? { entityType: { notIn: input.excludedEntityTypes } }
          : {}),
      },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        actor: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  create(data: Prisma.AuditLogUncheckedCreateInput) {
    return this.prisma.auditLog.create({ data });
  }
}
