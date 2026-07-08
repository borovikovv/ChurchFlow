import { Injectable } from '@nestjs/common';
import type { OrganizationRole, Prisma } from '@churchflow/db';
import type {
  CreateManualOrganizationMemberInput,
  OrganizationMembersAccessFilter,
  UpdateOrganizationMemberProfileInput,
} from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MembershipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForOrganization(organizationId: string, access: OrganizationMembersAccessFilter) {
    const now = new Date();
    const accessWhere: Record<
      OrganizationMembersAccessFilter,
      Prisma.OrganizationMemberWhereInput
    > = {
      all: {},
      connected: {
        user: {
          accounts: { some: { provider: 'telegram', deletedAt: null } },
        },
      },
      offline: {
        userId: null,
        claims: {
          none: {
            status: { in: ['PENDING', 'REQUESTED'] },
            expiresAt: { gt: now },
          },
        },
      },
      requested: {
        userId: null,
        claims: {
          some: {
            status: 'REQUESTED',
            expiresAt: { gt: now },
          },
        },
      },
      suspended: { status: 'SUSPENDED' },
    };

    return this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        status: { in: ['ACTIVE', 'SUSPENDED'] },
        removedAt: null,
        ...accessWhere[access],
      },
      include: {
        profile: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            accounts: {
              where: { provider: 'telegram', deletedAt: null },
              select: { id: true },
              take: 1,
            },
          },
        },
        claims: {
          where:
            access === 'requested'
              ? { status: 'REQUESTED', expiresAt: { gt: now } }
              : { status: { in: ['PENDING', 'REQUESTED'] } },
          select: {
            id: true,
            status: true,
            expiresAt: true,
            requestedAt: true,
            requestedBy: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createManualMember(
    organizationId: string,
    input: CreateManualOrganizationMemberInput,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findFirst({
        where: { id: organizationId, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });
      if (!organization) throw new Error('ORGANIZATION_NOT_ACTIVE');

      const actor = await tx.organizationMember.findFirst({
        where: {
          organizationId,
          userId: actorUserId,
          role: { in: ['OWNER', 'ADMIN'] },
          status: 'ACTIVE',
          removedAt: null,
        },
        select: { id: true, role: true },
      });
      if (!actor) throw new Error('ACTOR_CANNOT_MANAGE_MEMBERS');

      const membership = await tx.organizationMember.create({
        data: {
          organizationId,
          userId: null,
          role: input.role,
          status: 'ACTIVE',
          source: 'MANUAL',
          createdByUserId: actorUserId,
          profile: {
            create: {
              displayName: input.displayName,
              email: input.email ?? null,
              phone: input.phone ?? null,
              notes: input.notes ?? null,
              memberSince: input.memberSince
                ? new Date(`${input.memberSince}T00:00:00.000Z`)
                : null,
              birthday: input.birthday ? new Date(`${input.birthday}T00:00:00.000Z`) : null,
              anniversary: input.anniversary
                ? new Date(`${input.anniversary}T00:00:00.000Z`)
                : null,
              biography: input.biography ?? null,
              familyNotes: input.familyNotes ?? null,
            },
          },
        },
        include: { profile: true },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'CREATE_MANUAL_MEMBER',
          entityType: 'OrganizationMember',
          entityId: membership.id,
          metadata: { role: input.role, source: 'MANUAL' },
        },
      });

      return membership;
    });
  }

  async updateProfile(
    organizationId: string,
    membershipId: string,
    input: UpdateOrganizationMemberProfileInput,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const actor = await tx.organizationMember.findFirst({
        where: {
          organizationId,
          userId: actorUserId,
          role: { in: ['OWNER', 'ADMIN'] },
          status: 'ACTIVE',
          removedAt: null,
          organization: { status: 'ACTIVE', deletedAt: null },
        },
        select: { id: true },
      });
      if (!actor) throw new Error('ACTOR_CANNOT_MANAGE_MEMBERS');

      const membership = await tx.organizationMember.findFirst({
        where: { id: membershipId, organizationId, status: { not: 'REMOVED' } },
        select: { id: true },
      });
      if (!membership) throw new Error('MEMBERSHIP_NOT_FOUND');

      const profile = await tx.organizationMemberProfile.upsert({
        where: { membershipId },
        create: {
          membershipId,
          displayName: input.displayName ?? 'Member',
          email: input.email ?? null,
          phone: input.phone ?? null,
          notes: input.notes ?? null,
          memberSince: input.memberSince ? new Date(`${input.memberSince}T00:00:00.000Z`) : null,
          birthday: input.birthday ? new Date(`${input.birthday}T00:00:00.000Z`) : null,
          anniversary: input.anniversary ? new Date(`${input.anniversary}T00:00:00.000Z`) : null,
          biography: input.biography ?? null,
          familyNotes: input.familyNotes ?? null,
        },
        update: {
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.memberSince !== undefined
            ? {
                memberSince: input.memberSince
                  ? new Date(`${input.memberSince}T00:00:00.000Z`)
                  : null,
              }
            : {}),
          ...(input.birthday !== undefined
            ? {
                birthday: input.birthday ? new Date(`${input.birthday}T00:00:00.000Z`) : null,
              }
            : {}),
          ...(input.anniversary !== undefined
            ? {
                anniversary: input.anniversary
                  ? new Date(`${input.anniversary}T00:00:00.000Z`)
                  : null,
              }
            : {}),
          ...(input.biography !== undefined ? { biography: input.biography } : {}),
          ...(input.familyNotes !== undefined ? { familyNotes: input.familyNotes } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'UPDATE_MEMBER_PROFILE',
          entityType: 'OrganizationMember',
          entityId: membershipId,
          metadata: { changedFields: Object.keys(input) },
        },
      });

      return profile;
    });
  }

  async listRelationships(organizationId: string, membershipId: string) {
    return this.prisma.organizationMemberRelationship.findMany({
      where: {
        organizationId,
        OR: [{ fromMembershipId: membershipId }, { toMembershipId: membershipId }],
      },
      include: {
        fromMembership: { include: { profile: true } },
        toMembership: { include: { profile: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createRelationship(input: {
    organizationId: string;
    membershipId: string;
    relatedMembershipId: string;
    type: 'SPOUSE' | 'PARENT' | 'CHILD' | 'SIBLING' | 'OTHER';
    notes?: string | null | undefined;
    actorUserId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const actor = await tx.organizationMember.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: input.actorUserId,
          role: { in: ['OWNER', 'ADMIN'] },
          status: 'ACTIVE',
          removedAt: null,
          organization: { status: 'ACTIVE', deletedAt: null },
        },
      });
      if (!actor) throw new Error('ACTOR_CANNOT_MANAGE_MEMBERS');
      const members = await tx.organizationMember.findMany({
        where: {
          organizationId: input.organizationId,
          id: { in: [input.membershipId, input.relatedMembershipId] },
          status: { not: 'REMOVED' },
          removedAt: null,
        },
        select: { id: true },
      });
      if (input.membershipId === input.relatedMembershipId) throw new Error('SELF_RELATIONSHIP');
      if (members.length !== 2) throw new Error('MEMBERSHIP_NOT_FOUND');
      let fromMembershipId = input.membershipId;
      let toMembershipId = input.relatedMembershipId;
      let type = input.type;
      if (type === 'CHILD') {
        [fromMembershipId, toMembershipId] = [toMembershipId, fromMembershipId];
        type = 'PARENT';
      }
      if (type !== 'PARENT' && fromMembershipId > toMembershipId)
        [fromMembershipId, toMembershipId] = [toMembershipId, fromMembershipId];
      const existing = await tx.organizationMemberRelationship.findFirst({
        where: { organizationId: input.organizationId, fromMembershipId, toMembershipId, type },
      });
      if (existing) throw new Error('RELATIONSHIP_EXISTS');
      const relationship = await tx.organizationMemberRelationship.create({
        data: {
          organizationId: input.organizationId,
          fromMembershipId,
          toMembershipId,
          type,
          notes: input.notes ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'CREATE_MEMBER_RELATIONSHIP',
          entityType: 'OrganizationMemberRelationship',
          entityId: relationship.id,
          metadata: { type },
        },
      });
      return relationship;
    });
  }

  async deleteRelationship(organizationId: string, relationshipId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const actor = await tx.organizationMember.findFirst({
        where: {
          organizationId,
          userId: actorUserId,
          role: { in: ['OWNER', 'ADMIN'] },
          status: 'ACTIVE',
          removedAt: null,
        },
      });
      if (!actor) throw new Error('ACTOR_CANNOT_MANAGE_MEMBERS');
      const relationship = await tx.organizationMemberRelationship.findFirst({
        where: { id: relationshipId, organizationId },
      });
      if (!relationship) throw new Error('RELATIONSHIP_NOT_FOUND');
      await tx.organizationMemberRelationship.delete({ where: { id: relationshipId } });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'DELETE_MEMBER_RELATIONSHIP',
          entityType: 'OrganizationMemberRelationship',
          entityId: relationshipId,
        },
      });
      return { deletedRelationshipId: relationshipId };
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

      await tx.membershipClaim.updateMany({
        where: { membershipId: membership.id, status: { in: ['PENDING', 'REQUESTED'] } },
        data: { status: 'REVOKED', revokedAt: new Date() },
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

      if (membership.userId === null && (input.role === 'OWNER' || input.role === 'ADMIN')) {
        throw new Error('UNCLAIMED_ELEVATED_ROLE');
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
