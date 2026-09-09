import { Injectable } from '@nestjs/common';
import type { OrganizationRole, Prisma } from '@churchflow/db';
import type {
  AddOrganizationGroupMembersInput,
  CreateOrganizationGroupInput,
  UpdateOrganizationGroupInput,
  UpdateOrganizationGroupMemberInput,
} from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';

// The picker offers these memberships and the write path accepts exactly the same set.
const ASSIGNABLE_MEMBERSHIP: Prisma.OrganizationMemberWhereInput = {
  status: { in: ['ACTIVE', 'SUSPENDED'] },
  removedAt: null,
};

const groupMemberInclude = {
  membership: {
    select: {
      id: true,
      profile: { select: { displayName: true } },
      user: { select: { displayName: true, email: true, avatarUrl: true } },
    },
  },
} as const;

// Membership removal is a soft delete, so group rows outlive it. Every read filters the
// removed members out; counts included, or a group keeps reporting people who left.
const presentMember = { membership: { removedAt: null } } as const;

const groupListInclude = {
  members: {
    where: { role: 'LEADER' as const, ...presentMember },
    include: groupMemberInclude,
    orderBy: { createdAt: 'asc' as const },
  },
  _count: { select: { members: { where: presentMember } } },
} as const;

const groupDetailInclude = {
  members: {
    where: presentMember,
    include: groupMemberInclude,
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

export type OrganizationGroupListRecord = Prisma.OrganizationGroupGetPayload<{
  include: typeof groupListInclude;
}>;

export type OrganizationGroupDetailRecord = Prisma.OrganizationGroupGetPayload<{
  include: typeof groupDetailInclude;
}>;

export interface OrganizationGroupActor {
  id: string;
  role: OrganizationRole;
  permissions: string[];
}

export class UnknownGroupMembershipsError extends Error {
  constructor(readonly membershipIds: string[]) {
    super('UNKNOWN_GROUP_MEMBERSHIPS');
  }
}

@Injectable()
export class GroupsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveMembership(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationGroupActor | null> {
    return this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        status: 'ACTIVE',
        removedAt: null,
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true, role: true, permissions: true },
    });
  }

  listForOrganization(organizationId: string): Promise<OrganizationGroupListRecord[]> {
    return this.prisma.organizationGroup.findMany({
      where: { organizationId },
      include: groupListInclude,
      orderBy: { name: 'asc' },
    });
  }

  findById(
    organizationId: string,
    groupId: string,
  ): Promise<OrganizationGroupDetailRecord | null> {
    return this.prisma.organizationGroup.findFirst({
      where: { id: groupId, organizationId },
      include: groupDetailInclude,
    });
  }

  listDetailsForOrganization(organizationId: string): Promise<OrganizationGroupDetailRecord[]> {
    return this.prisma.organizationGroup.findMany({
      where: { organizationId },
      include: groupDetailInclude,
      orderBy: { name: 'asc' },
    });
  }

  listMemberCandidates(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId, ...ASSIGNABLE_MEMBERSHIP },
      select: {
        id: true,
        profile: { select: { displayName: true } },
        user: { select: { displayName: true, email: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async create(input: {
    organizationId: string;
    actorUserId: string;
    group: CreateOrganizationGroupInput;
  }): Promise<OrganizationGroupDetailRecord> {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.organizationGroup.create({
        data: {
          organizationId: input.organizationId,
          name: input.group.name,
          description: input.group.description ?? null,
          icon: input.group.icon,
          color: input.group.color,
          createdByUserId: input.actorUserId,
        },
        include: groupDetailInclude,
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'CREATE',
          entityType: 'OrganizationGroup',
          entityId: group.id,
          metadata: { name: group.name, icon: group.icon, color: group.color },
        },
      });

      return group;
    });
  }

  async update(input: {
    organizationId: string;
    groupId: string;
    actorUserId: string;
    group: UpdateOrganizationGroupInput;
  }): Promise<OrganizationGroupDetailRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.organizationGroup.findFirst({
        where: { id: input.groupId, organizationId: input.organizationId },
        select: { id: true },
      });
      if (!existing) return null;

      const group = await tx.organizationGroup.update({
        where: { id: input.groupId },
        data: {
          ...(input.group.name !== undefined ? { name: input.group.name } : {}),
          ...(input.group.description !== undefined
            ? { description: input.group.description }
            : {}),
          ...(input.group.icon !== undefined ? { icon: input.group.icon } : {}),
          ...(input.group.color !== undefined ? { color: input.group.color } : {}),
        },
        include: groupDetailInclude,
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'UPDATE',
          entityType: 'OrganizationGroup',
          entityId: group.id,
          metadata: changedGroupFields(input.group),
        },
      });

      return group;
    });
  }

  async delete(input: {
    organizationId: string;
    groupId: string;
    actorUserId: string;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.organizationGroup.findFirst({
        where: { id: input.groupId, organizationId: input.organizationId },
        select: { id: true, name: true },
      });
      if (!group) return false;

      await tx.organizationGroup.delete({ where: { id: group.id } });
      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'DELETE',
          entityType: 'OrganizationGroup',
          entityId: group.id,
          metadata: { name: group.name },
        },
      });

      return true;
    });
  }

  async addMembers(input: {
    organizationId: string;
    groupId: string;
    actorUserId: string;
    members: AddOrganizationGroupMembersInput['members'];
  }): Promise<OrganizationGroupDetailRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.organizationGroup.findFirst({
        where: { id: input.groupId, organizationId: input.organizationId },
        select: { id: true },
      });
      if (!group) return null;

      const membershipIds = input.members.map((member) => member.membershipId);
      const known = await tx.organizationMember.findMany({
        where: {
          id: { in: membershipIds },
          organizationId: input.organizationId,
          ...ASSIGNABLE_MEMBERSHIP,
        },
        select: { id: true },
      });
      const knownIds = new Set(known.map((membership) => membership.id));
      const unknownIds = membershipIds.filter((membershipId) => !knownIds.has(membershipId));
      if (unknownIds.length > 0) throw new UnknownGroupMembershipsError(unknownIds);

      for (const member of input.members) {
        await tx.organizationGroupMember.upsert({
          where: {
            groupId_membershipId: { groupId: input.groupId, membershipId: member.membershipId },
          },
          create: {
            organizationId: input.organizationId,
            groupId: input.groupId,
            membershipId: member.membershipId,
            role: member.role,
            responsibility: member.responsibility ?? null,
          },
          update: {
            role: member.role,
            responsibility: member.responsibility ?? null,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'UPDATE',
          entityType: 'OrganizationGroup',
          entityId: input.groupId,
          metadata: { addedMembershipIds: membershipIds },
        },
      });

      return tx.organizationGroup.findFirstOrThrow({
        where: { id: input.groupId, organizationId: input.organizationId },
        include: groupDetailInclude,
      });
    });
  }

  async updateMember(input: {
    organizationId: string;
    groupId: string;
    membershipId: string;
    actorUserId: string;
    member: UpdateOrganizationGroupMemberInput;
  }): Promise<OrganizationGroupDetailRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.organizationGroupMember.findFirst({
        where: {
          groupId: input.groupId,
          membershipId: input.membershipId,
          organizationId: input.organizationId,
        },
        select: { groupId: true },
      });
      if (!existing) return null;

      await tx.organizationGroupMember.update({
        where: {
          groupId_membershipId: { groupId: input.groupId, membershipId: input.membershipId },
        },
        data: {
          ...(input.member.role !== undefined ? { role: input.member.role } : {}),
          ...(input.member.responsibility !== undefined
            ? { responsibility: input.member.responsibility }
            : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'UPDATE',
          entityType: 'OrganizationGroup',
          entityId: input.groupId,
          metadata: {
            membershipId: input.membershipId,
            ...(input.member.role !== undefined ? { role: input.member.role } : {}),
          },
        },
      });

      return tx.organizationGroup.findFirstOrThrow({
        where: { id: input.groupId, organizationId: input.organizationId },
        include: groupDetailInclude,
      });
    });
  }

  async removeMember(input: {
    organizationId: string;
    groupId: string;
    membershipId: string;
    actorUserId: string;
  }): Promise<OrganizationGroupDetailRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.organizationGroupMember.findFirst({
        where: {
          groupId: input.groupId,
          membershipId: input.membershipId,
          organizationId: input.organizationId,
        },
        select: { groupId: true },
      });
      if (!existing) return null;

      await tx.organizationGroupMember.delete({
        where: {
          groupId_membershipId: { groupId: input.groupId, membershipId: input.membershipId },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'UPDATE',
          entityType: 'OrganizationGroup',
          entityId: input.groupId,
          metadata: { removedMembershipId: input.membershipId },
        },
      });

      return tx.organizationGroup.findFirstOrThrow({
        where: { id: input.groupId, organizationId: input.organizationId },
        include: groupDetailInclude,
      });
    });
  }
}

function changedGroupFields(group: UpdateOrganizationGroupInput): Prisma.InputJsonObject {
  return Object.fromEntries(Object.entries(group).filter(([, value]) => value !== undefined));
}
