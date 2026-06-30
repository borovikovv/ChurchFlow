import { Injectable } from '@nestjs/common';
import type { OrganizationRole, Prisma } from '@churchflow/db';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MembershipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForOrganization(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId, status: 'ACTIVE', removedAt: null },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveMembership(organizationId: string, userId: string) {
    return this.prisma.organizationMember.findFirst({
      where: { organizationId, userId, status: 'ACTIVE', removedAt: null },
    });
  }

  async findActiveMembershipById(organizationId: string, membershipId: string) {
    return this.prisma.organizationMember.findFirst({
      where: { id: membershipId, organizationId, status: 'ACTIVE', removedAt: null },
      include: { user: true },
    });
  }

  async removeMembership(input: {
    organizationId: string;
    membershipId: string;
    actorUserId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM organization_members
        WHERE organization_id = ${input.organizationId}::uuid
          AND role = 'OWNER'
          AND status = 'ACTIVE'
          AND removed_at IS NULL
        FOR UPDATE
      `;

      const actor = await tx.organizationMember.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: input.actorUserId,
          role: 'OWNER',
          status: 'ACTIVE',
          removedAt: null,
        },
      });
      if (!actor) {
        throw new Error('ACTOR_NOT_OWNER');
      }

      const membership = await tx.organizationMember.findFirst({
        where: {
          id: input.membershipId,
          organizationId: input.organizationId,
          status: 'ACTIVE',
          removedAt: null,
        },
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
            removedAt: null,
          },
        });
        if (ownerCount <= 1) {
          throw new Error('LAST_OWNER');
        }
      }

      const removed = await tx.organizationMember.update({
        where: { id: membership.id },
        data: {
          status: 'REMOVED',
          removedAt: new Date(),
        },
      });

      const metadata: Prisma.InputJsonObject = {
        removedUserId: membership.userId,
        removedRole: membership.role,
      };

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'REMOVE_MEMBER',
          entityType: 'OrganizationMember',
          entityId: removed.id,
          metadata,
        },
      });

      return removed;
    });
  }

  async updateRole(input: {
    organizationId: string;
    membershipId: string;
    role: OrganizationRole;
    actorUserId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM organization_members
        WHERE organization_id = ${input.organizationId}::uuid
          AND role = 'OWNER'
          AND status = 'ACTIVE'
          AND removed_at IS NULL
        FOR UPDATE
      `;

      const actor = await tx.organizationMember.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: input.actorUserId,
          role: 'OWNER',
          status: 'ACTIVE',
          removedAt: null,
        },
      });
      if (!actor) {
        throw new Error('ACTOR_NOT_OWNER');
      }

      const membership = await tx.organizationMember.findFirst({
        where: {
          id: input.membershipId,
          organizationId: input.organizationId,
          status: 'ACTIVE',
          removedAt: null,
        },
      });
      if (!membership) {
        throw new Error('MEMBERSHIP_NOT_ACTIVE');
      }

      if (membership.role === 'OWNER' && input.role !== 'OWNER') {
        const ownerCount = await tx.organizationMember.count({
          where: {
            organizationId: input.organizationId,
            role: 'OWNER',
            status: 'ACTIVE',
            removedAt: null,
          },
        });
        if (ownerCount <= 1) {
          throw new Error('LAST_OWNER');
        }
      }

      const updated = await tx.organizationMember.update({
        where: { id: membership.id },
        data: { role: input.role },
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'CHANGE_MEMBER_ROLE',
          entityType: 'OrganizationMember',
          entityId: membership.id,
          metadata: {
            userId: membership.userId,
            previousRole: membership.role,
            role: input.role,
          },
        },
      });

      return updated;
    });
  }
}
