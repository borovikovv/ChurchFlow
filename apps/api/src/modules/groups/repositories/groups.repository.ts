import { Injectable } from '@nestjs/common';
import type { OrganizationRole, Prisma } from '@churchflow/db';
import {
  CALENDAR_SERVICE_ROLES,
  ORGANIZATION_GROUP_BOARD_COMPUTED_NODE_KEYS,
  serviceRoleGroupsFromLinks,
} from '@churchflow/shared';
import type {
  AddOrganizationGroupMembersInput,
  CalendarServiceRole,
  CreateOrganizationGroupInput,
  OrganizationGroupBoardNodePosition,
  OrganizationGroupMemberRole,
  ServiceRoleGroups,
  UpdateOrganizationGroupInput,
  UpdateOrganizationGroupMemberInput,
} from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { userAvatarSelect } from '../../media/user-avatar-url';

// The picker offers these memberships and the write path accepts exactly the same set.
const ASSIGNABLE_MEMBERSHIP: Prisma.OrganizationMemberWhereInput = {
  status: { in: ['ACTIVE', 'SUSPENDED'] },
  removedAt: null,
};

const boardPersonSelect = {
  id: true,
  profile: {
    select: {
      displayName: true,
      profilePhotoAsset: { select: { id: true } },
    },
  },
  user: { select: { displayName: true, email: true, ...userAvatarSelect } },
} as const;

const groupMemberInclude = {
  membership: { select: boardPersonSelect },
} as const;

// Membership removal is a soft delete, so group rows outlive it. Every read filters the
// removed members out; counts included, or a group keeps reporting people who left.
const presentMember = { membership: { removedAt: null } } as const;

const groupServiceRolesInclude = {
  serviceRoles: { select: { role: true } },
} as const;

const groupListInclude = {
  ...groupServiceRolesInclude,
  members: {
    where: { role: 'LEADER' as const, ...presentMember },
    include: groupMemberInclude,
    orderBy: { createdAt: 'asc' as const },
  },
  _count: { select: { members: { where: presentMember } } },
} as const;

const groupDetailInclude = {
  ...groupServiceRolesInclude,
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

export type OrganizationGroupBoardPersonRecord = Prisma.OrganizationMemberGetPayload<{
  select: typeof boardPersonSelect;
}>;

export interface OrganizationGroupMoveRecord {
  sourceGroup: OrganizationGroupDetailRecord;
  targetGroup: OrganizationGroupDetailRecord;
}

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

export class UnknownServiceRoleGroupsError extends Error {
  constructor(readonly groupIds: string[]) {
    super('UNKNOWN_SERVICE_ROLE_GROUPS');
  }
}

export class UnknownGroupBoardNodesError extends Error {
  constructor(readonly nodeKeys: string[]) {
    super('UNKNOWN_GROUP_BOARD_NODES');
  }
}

const COMPUTED_BOARD_NODE_KEYS: ReadonlySet<string> = new Set(
  ORGANIZATION_GROUP_BOARD_COMPUTED_NODE_KEYS,
);

// A reset saves every node at once, one upsert each, which can outlast Prisma's 5s default
// for the largest layout the schema accepts.
const BOARD_LAYOUT_TRANSACTION_TIMEOUT_MS = 30_000;

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

  findById(organizationId: string, groupId: string): Promise<OrganizationGroupDetailRecord | null> {
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

  /**
   * People who belong to no group, split by visitor status. Uses the same membership filter the
   * add path accepts, so everyone listed here can be dropped into a group.
   */
  listUngroupedPeople(
    organizationId: string,
    kind: 'members' | 'visitors',
  ): Promise<OrganizationGroupBoardPersonRecord[]> {
    return this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        ...ASSIGNABLE_MEMBERSHIP,
        role: kind === 'visitors' ? 'VIEWER' : { not: 'VIEWER' },
        groups: { none: {} },
      },
      select: boardPersonSelect,
      orderBy: { joinedAt: 'asc' },
    });
  }

  listBoardLayout(organizationId: string): Promise<OrganizationGroupBoardNodePosition[]> {
    return this.prisma.organizationGroupBoardNode.findMany({
      where: { organizationId },
      select: { nodeKey: true, x: true, y: true },
    });
  }

  async saveBoardLayout(input: {
    organizationId: string;
    actorUserId: string;
    nodes: OrganizationGroupBoardNodePosition[];
  }): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const groupIds = input.nodes
          .map((node) => node.nodeKey)
          .filter((nodeKey) => !COMPUTED_BOARD_NODE_KEYS.has(nodeKey));
        const known = groupIds.length
          ? await tx.organizationGroup.findMany({
              where: { id: { in: groupIds }, organizationId: input.organizationId },
              select: { id: true },
            })
          : [];
        const knownIds = new Set(known.map((group) => group.id));
        const unknownKeys = groupIds.filter((groupId) => !knownIds.has(groupId));
        if (unknownKeys.length > 0) throw new UnknownGroupBoardNodesError(unknownKeys);

        for (const node of input.nodes) {
          await tx.organizationGroupBoardNode.upsert({
            where: {
              organizationId_nodeKey: {
                organizationId: input.organizationId,
                nodeKey: node.nodeKey,
              },
            },
            create: {
              organizationId: input.organizationId,
              nodeKey: node.nodeKey,
              x: node.x,
              y: node.y,
              updatedByUserId: input.actorUserId,
            },
            update: { x: node.x, y: node.y, updatedByUserId: input.actorUserId },
          });
        }
      },
      { timeout: BOARD_LAYOUT_TRANSACTION_TIMEOUT_MS },
    );
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
      const serviceRoles = input.group.serviceRoles ?? [];
      await linkGroupToServiceRoles(tx, input.organizationId, group.id, serviceRoles);

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'CREATE',
          entityType: 'OrganizationGroup',
          entityId: group.id,
          metadata: {
            name: group.name,
            icon: group.icon,
            color: group.color,
            ...(serviceRoles.length > 0 ? { serviceRoles } : {}),
          },
        },
      });

      return serviceRoles.length > 0
        ? tx.organizationGroup.findFirstOrThrow({
            where: { id: group.id, organizationId: input.organizationId },
            include: groupDetailInclude,
          })
        : group;
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
        where: { id_organizationId: { id: input.groupId, organizationId: input.organizationId } },
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
      if (input.group.serviceRoles !== undefined) {
        await replaceGroupServiceRoles(
          tx,
          input.organizationId,
          input.groupId,
          input.group.serviceRoles,
        );
      }

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

      return input.group.serviceRoles !== undefined
        ? tx.organizationGroup.findFirstOrThrow({
            where: { id: input.groupId, organizationId: input.organizationId },
            include: groupDetailInclude,
          })
        : group;
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
        select: { id: true, name: true, serviceRoles: { select: { role: true } } },
      });
      if (!group) return false;

      await tx.organizationGroup.delete({
        where: { id_organizationId: { id: group.id, organizationId: input.organizationId } },
      });
      await tx.organizationGroupBoardNode.deleteMany({
        where: { organizationId: input.organizationId, nodeKey: group.id },
      });
      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'DELETE',
          entityType: 'OrganizationGroup',
          entityId: group.id,
          metadata: {
            name: group.name,
            ...(group.serviceRoles.length > 0
              ? { serviceRoles: group.serviceRoles.map(({ role }) => role) }
              : {}),
          },
        },
      });

      return true;
    });
  }

  async listServiceRoleGroups(organizationId: string): Promise<ServiceRoleGroups> {
    const rows = await this.prisma.organizationServiceRoleGroup.findMany({
      where: { organizationId },
      select: { role: true, groupId: true },
      orderBy: [{ role: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
    });

    return serviceRoleGroupsFromLinks(rows);
  }

  /** Replaces the groups of every role at once; a group of another organization is refused. */
  async replaceServiceRoleGroups(input: {
    organizationId: string;
    actorUserId: string;
    roles: ServiceRoleGroups;
  }): Promise<ServiceRoleGroups> {
    return this.prisma.$transaction(async (tx) => {
      const groupIds = [...new Set(Object.values(input.roles).flat())];
      const known = groupIds.length
        ? await tx.organizationGroup.findMany({
            where: { id: { in: groupIds }, organizationId: input.organizationId },
            select: { id: true },
          })
        : [];
      const knownIds = new Set(known.map((group) => group.id));
      const unknownIds = groupIds.filter((groupId) => !knownIds.has(groupId));
      if (unknownIds.length > 0) throw new UnknownServiceRoleGroupsError(unknownIds);

      await tx.organizationServiceRoleGroup.deleteMany({
        where: { organizationId: input.organizationId },
      });
      const rows = CALENDAR_SERVICE_ROLES.flatMap((role) =>
        input.roles[role].map((groupId, position) => ({
          organizationId: input.organizationId,
          role,
          groupId,
          position,
        })),
      );
      if (rows.length > 0) await tx.organizationServiceRoleGroup.createMany({ data: rows });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'UPDATE',
          entityType: 'ServiceRoleGroups',
          entityId: input.organizationId,
          metadata: { roles: input.roles },
        },
      });

      return serviceRoleGroupsFromLinks(rows);
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

      await tx.organizationGroupMember.updateMany({
        where: {
          groupId: input.groupId,
          membershipId: input.membershipId,
          organizationId: input.organizationId,
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

  /**
   * Moves one person from a group to another in a single transaction. A person already in the
   * target keeps that row and takes the requested role, so a move never duplicates a membership.
   */
  async moveMember(input: {
    organizationId: string;
    sourceGroupId: string;
    targetGroupId: string;
    membershipId: string;
    role: OrganizationGroupMemberRole;
    actorUserId: string;
  }): Promise<OrganizationGroupMoveRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const groups = await tx.organizationGroup.findMany({
        where: {
          id: { in: [input.sourceGroupId, input.targetGroupId] },
          organizationId: input.organizationId,
        },
        select: { id: true },
      });
      if (groups.length !== 2) return null;

      const sourceRow: Prisma.OrganizationGroupMemberWhereInput = {
        groupId: input.sourceGroupId,
        membershipId: input.membershipId,
        organizationId: input.organizationId,
        membership: { organizationId: input.organizationId, ...ASSIGNABLE_MEMBERSHIP },
      };
      const existing = await tx.organizationGroupMember.findFirst({
        where: sourceRow,
        select: { responsibility: true },
      });
      if (!existing) return null;

      // A concurrent move of the same person may already have taken the row.
      const removed = await tx.organizationGroupMember.deleteMany({ where: sourceRow });
      if (removed.count === 0) return null;

      await tx.organizationGroupMember.upsert({
        where: {
          groupId_membershipId: { groupId: input.targetGroupId, membershipId: input.membershipId },
        },
        create: {
          organizationId: input.organizationId,
          groupId: input.targetGroupId,
          membershipId: input.membershipId,
          role: input.role,
          responsibility: existing.responsibility,
        },
        update: { role: input.role },
      });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'UPDATE',
          entityType: 'OrganizationGroup',
          entityId: input.sourceGroupId,
          metadata: { movedMembershipId: input.membershipId, toGroupId: input.targetGroupId },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'UPDATE',
          entityType: 'OrganizationGroup',
          entityId: input.targetGroupId,
          metadata: {
            movedMembershipId: input.membershipId,
            fromGroupId: input.sourceGroupId,
            role: input.role,
          },
        },
      });

      const sourceGroup = await tx.organizationGroup.findFirstOrThrow({
        where: { id: input.sourceGroupId, organizationId: input.organizationId },
        include: groupDetailInclude,
      });
      const targetGroup = await tx.organizationGroup.findFirstOrThrow({
        where: { id: input.targetGroupId, organizationId: input.organizationId },
        include: groupDetailInclude,
      });

      return { sourceGroup, targetGroup };
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

      await tx.organizationGroupMember.deleteMany({
        where: {
          groupId: input.groupId,
          membershipId: input.membershipId,
          organizationId: input.organizationId,
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

type ServiceRoleTransaction = Pick<Prisma.TransactionClient, 'organizationServiceRoleGroup'>;

/** Appends the group to the end of each role's list, so groups linked earlier keep their order. */
async function linkGroupToServiceRoles(
  tx: ServiceRoleTransaction,
  organizationId: string,
  groupId: string,
  roles: readonly CalendarServiceRole[],
): Promise<void> {
  for (const role of roles) {
    const last = await tx.organizationServiceRoleGroup.findFirst({
      where: { organizationId, role },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    await tx.organizationServiceRoleGroup.create({
      data: { organizationId, role, groupId, position: (last?.position ?? -1) + 1 },
    });
  }
}

async function replaceGroupServiceRoles(
  tx: ServiceRoleTransaction,
  organizationId: string,
  groupId: string,
  roles: readonly CalendarServiceRole[],
): Promise<void> {
  const current = await tx.organizationServiceRoleGroup.findMany({
    where: { organizationId, groupId },
    select: { role: true },
  });
  const currentRoles = new Set(current.map(({ role }) => role));
  const removed = [...currentRoles].filter((role) => !roles.includes(role));
  if (removed.length > 0) {
    await tx.organizationServiceRoleGroup.deleteMany({
      where: { organizationId, groupId, role: { in: removed } },
    });
  }
  await linkGroupToServiceRoles(
    tx,
    organizationId,
    groupId,
    roles.filter((role) => !currentRoles.has(role)),
  );
}

function changedGroupFields(group: UpdateOrganizationGroupInput): Prisma.InputJsonObject {
  return Object.fromEntries(Object.entries(group).filter(([, value]) => value !== undefined));
}
