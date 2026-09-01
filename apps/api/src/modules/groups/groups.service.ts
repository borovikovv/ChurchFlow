import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import { ORG_PERMISSIONS } from '@churchflow/shared';
import type {
  AddOrganizationGroupMembersInput,
  CreateOrganizationGroupInput,
  OrganizationGroupDetail,
  OrganizationGroupDetailPayload,
  OrganizationGroupListItem,
  OrganizationGroupsPayload,
  UpdateOrganizationGroupInput,
  UpdateOrganizationGroupMemberInput,
} from '@churchflow/shared';
import {
  GroupsRepository,
  UnknownGroupMembershipsError,
  type OrganizationGroupActor,
  type OrganizationGroupDetailRecord,
  type OrganizationGroupListRecord,
} from './repositories/groups.repository';

@Injectable()
export class GroupsService {
  constructor(private readonly groupsRepository: GroupsRepository) {}

  async listForOrganization(
    organizationId: string,
    actorUserId: string,
  ): Promise<OrganizationGroupsPayload> {
    const [groups, actor] = await Promise.all([
      this.groupsRepository.listForOrganization(organizationId),
      this.groupsRepository.findActiveMembership(organizationId, actorUserId),
    ]);

    return {
      canManage: canManageGroups(actor),
      groups: groups.map(groupToListItem),
    };
  }

  async findById(
    organizationId: string,
    groupId: string,
    actorUserId: string,
  ): Promise<OrganizationGroupDetailPayload> {
    const [group, actor] = await Promise.all([
      this.groupsRepository.findById(organizationId, groupId),
      this.groupsRepository.findActiveMembership(organizationId, actorUserId),
    ]);
    if (!group) throw new NotFoundException('Group was not found');

    // Only the add-member dialog reads the roster, and only a manager can open it.
    const canManage = canManageGroups(actor);
    const candidates = canManage
      ? await this.groupsRepository.listMemberCandidates(organizationId)
      : [];

    return {
      canManage,
      group: groupToDetail(group),
      memberCandidates: candidates.map((candidate) => ({
        id: candidate.id,
        displayName: membershipDisplayName(candidate),
      })),
    };
  }

  async listDetailsForOrganization(organizationId: string): Promise<OrganizationGroupDetail[]> {
    const groups = await this.groupsRepository.listDetailsForOrganization(organizationId);

    return groups.map(groupToDetail);
  }

  async create(
    organizationId: string,
    input: CreateOrganizationGroupInput,
    actorUserId: string,
  ): Promise<OrganizationGroupDetail> {
    const group = await this.runUniqueName(() =>
      this.groupsRepository.create({ organizationId, actorUserId, group: input }),
    );

    return groupToDetail(group);
  }

  async update(
    organizationId: string,
    groupId: string,
    input: UpdateOrganizationGroupInput,
    actorUserId: string,
  ): Promise<OrganizationGroupDetail> {
    const group = await this.runUniqueName(() =>
      this.groupsRepository.update({ organizationId, groupId, actorUserId, group: input }),
    );
    if (!group) throw new NotFoundException('Group was not found');

    return groupToDetail(group);
  }

  async delete(
    organizationId: string,
    groupId: string,
    actorUserId: string,
  ): Promise<{ deletedGroupId: string }> {
    const deleted = await this.groupsRepository.delete({ organizationId, groupId, actorUserId });
    if (!deleted) throw new NotFoundException('Group was not found');

    return { deletedGroupId: groupId };
  }

  async addMembers(
    organizationId: string,
    groupId: string,
    input: AddOrganizationGroupMembersInput,
    actorUserId: string,
  ): Promise<OrganizationGroupDetail> {
    try {
      const group = await this.groupsRepository.addMembers({
        organizationId,
        groupId,
        actorUserId,
        members: input.members,
      });
      if (!group) throw new NotFoundException('Group was not found');

      return groupToDetail(group);
    } catch (error) {
      if (error instanceof UnknownGroupMembershipsError) {
        throw new BadRequestException('Some members do not belong to this organization');
      }

      throw error;
    }
  }

  async updateMember(
    organizationId: string,
    groupId: string,
    membershipId: string,
    input: UpdateOrganizationGroupMemberInput,
    actorUserId: string,
  ): Promise<OrganizationGroupDetail> {
    const group = await this.groupsRepository.updateMember({
      organizationId,
      groupId,
      membershipId,
      actorUserId,
      member: input,
    });
    if (!group) throw new NotFoundException('Group member was not found');

    return groupToDetail(group);
  }

  async removeMember(
    organizationId: string,
    groupId: string,
    membershipId: string,
    actorUserId: string,
  ): Promise<OrganizationGroupDetail> {
    const group = await this.groupsRepository.removeMember({
      organizationId,
      groupId,
      membershipId,
      actorUserId,
    });
    if (!group) throw new NotFoundException('Group member was not found');

    return groupToDetail(group);
  }

  private async runUniqueName<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isUniqueNameViolation(error)) {
        throw new ConflictException('A group with this name already exists');
      }

      throw error;
    }
  }
}

function canManageGroups(actor: OrganizationGroupActor | null): boolean {
  if (!actor) return false;
  if (actor.role === 'OWNER' || actor.role === 'ADMIN') return true;

  return actor.permissions.includes(ORG_PERMISSIONS.membersManage);
}

function groupToListItem(group: OrganizationGroupListRecord): OrganizationGroupListItem {
  return {
    id: group.id,
    name: group.name,
    icon: group.icon,
    color: group.color,
    description: group.description,
    memberCount: group._count.members,
    leaders: group.members.map((member) => ({
      membershipId: member.membershipId,
      displayName: membershipDisplayName(member.membership),
    })),
  };
}

function groupToDetail(group: OrganizationGroupDetailRecord): OrganizationGroupDetail {
  return {
    id: group.id,
    name: group.name,
    icon: group.icon,
    color: group.color,
    description: group.description,
    members: group.members.map((member) => ({
      membershipId: member.membershipId,
      displayName: membershipDisplayName(member.membership),
      photoUrl: member.membership.user?.avatarUrl ?? null,
      role: member.role,
      responsibility: member.responsibility,
    })),
  };
}

function membershipDisplayName(membership: {
  profile: { displayName: string } | null;
  user: { displayName: string | null; email: string | null } | null;
}): string {
  return (
    membership.profile?.displayName ??
    membership.user?.displayName ??
    membership.user?.email ??
    'Member'
  );
}

function isUniqueNameViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
