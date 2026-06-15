import { Injectable } from '@nestjs/common';
import type { Prisma } from '@churchflow/db';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MembershipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForOrganization(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId, status: 'ACTIVE', removedAt: null },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findActiveMembership(organizationId: string, userId: string) {
    return this.prisma.organizationMember.findFirst({
      where: { organizationId, userId, status: 'ACTIVE', removedAt: null }
    });
  }

  async findActiveMembershipById(organizationId: string, membershipId: string) {
    return this.prisma.organizationMember.findFirst({
      where: { id: membershipId, organizationId, status: 'ACTIVE', removedAt: null },
      include: { user: true }
    });
  }

  async removeMembership(input: {
    organizationId: string;
    membershipId: string;
    actorUserId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.organizationMember.findFirst({
        where: {
          id: input.membershipId,
          organizationId: input.organizationId,
          status: 'ACTIVE',
          removedAt: null
        }
      });
      if (!membership) {
        return null;
      }

      if (membership.role === 'OWNER') {
        const ownerCount = await tx.organizationMember.count({
          where: {
            organizationId: input.organizationId,
            role: 'OWNER',
            status: 'ACTIVE',
            removedAt: null
          }
        });
        if (ownerCount <= 1) {
          throw new Error('LAST_OWNER');
        }
      }

      const removed = await tx.organizationMember.update({
        where: { id: membership.id },
        data: {
          status: 'REMOVED',
          removedAt: new Date()
        }
      });

      const metadata: Prisma.InputJsonObject = {
        removedUserId: membership.userId,
        removedRole: membership.role
      };

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'REMOVE_MEMBER',
          entityType: 'OrganizationMember',
          entityId: removed.id,
          metadata
        }
      });

      return removed;
    });
  }
}
