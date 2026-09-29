import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import { organizationMediaContentUrl } from '../media/private-media-url';
import { userAvatarUrl } from '../media/user-avatar-url';
import { ORG_PERMISSIONS } from '@churchflow/shared';
import type {
  AddOrganizationGroupMembersInput,
  CreateOrganizationGroupInput,
  MoveOrganizationGroupMemberInput,
  MoveOrganizationGroupMemberResult,
  OrganizationGroupBoardPayload,
  OrganizationGroupBoardPerson,
  OrganizationGroupDetail,
  OrganizationGroupDetailPayload,
  OrganizationGroupListItem,
  OrganizationGroupsPayload,
  SaveOrganizationGroupBoardLayoutInput,
  UpdateOrganizationGroupInput,
  UpdateOrganizationGroupMemberInput,
} from '@churchflow/shared';
import {
  GroupsRepository,
  UnknownGroupBoardNodesError,
  UnknownGroupMembershipsError,
  type OrganizationGroupActor,
  type OrganizationGroupBoardPersonRecord,
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

    return groups.map((group) => groupToDetail(group));
  }

  async getBoard(
    organizationId: string,
    actorUserId: string,
  ): Promise<OrganizationGroupBoardPayload> {
    const [groups, unassignedMembers, visitors, layout, actor] = await Promise.all([
      this.groupsRepository.listDetailsForOrganization(organizationId),
      this.groupsRepository.listUngroupedPeople(organizationId, 'members'),
      this.groupsRepository.listUngroupedPeople(organizationId, 'visitors'),
      this.groupsRepository.listBoardLayout(organizationId),
      this.groupsRepository.findActiveMembership(organizationId, actorUserId),
    ]);

    return {
      canManage: canManageGroups(actor),
      groups: groups.map((group) => leadersFirst(groupToDetail(group))),
      unassignedMembers: unassignedMembers.map((person) => boardPerson(person, organizationId)),
      visitors: visitors.map((person) => boardPerson(person, organizationId)),
      layout,
    };
  }

  async saveBoardLayout(
    organizationId: string,
    input: SaveOrganizationGroupBoardLayoutInput,
    actorUserId: string,
  ): Promise<{ saved: number }> {
    try {
      await this.groupsRepository.saveBoardLayout({
        organizationId,
        actorUserId,
        nodes: input.nodes,
      });
    } catch (error) {
      if (error instanceof UnknownGroupBoardNodesError) {
        throw new BadRequestException('Some board nodes do not belong to this organization');
      }

      throw error;
    }

    return { saved: input.nodes.length };
  }

  async moveMember(
    organizationId: string,
    sourceGroupId: string,
    membershipId: string,
    input: MoveOrganizationGroupMemberInput,
    actorUserId: string,
  ): Promise<MoveOrganizationGroupMemberResult> {
    if (sourceGroupId === input.targetGroupId) {
      throw new BadRequestException('The target group must differ from the source group');
    }

    const moved = await this.groupsRepository.moveMember({
      organizationId,
      sourceGroupId,
      targetGroupId: input.targetGroupId,
      membershipId,
      role: input.role,
      actorUserId,
    });
    if (!moved) throw new NotFoundException('Group member was not found');

    return {
      sourceGroup: leadersFirst(groupToDetail(moved.sourceGroup)),
      targetGroup: leadersFirst(groupToDetail(moved.targetGroup)),
    };
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
      photoUrl: membershipPhotoUrl(member.membership, group.organizationId),
      role: member.role,
      responsibility: member.responsibility,
    })),
  };
}

function leadersFirst(group: OrganizationGroupDetail): OrganizationGroupDetail {
  return {
    ...group,
    members: [
      ...group.members.filter((member) => member.role === 'LEADER'),
      ...group.members.filter((member) => member.role !== 'LEADER'),
    ],
  };
}

function boardPerson(
  person: OrganizationGroupBoardPersonRecord,
  organizationId: string,
): OrganizationGroupBoardPerson {
  return {
    membershipId: person.id,
    displayName: membershipDisplayName(person),
    photoUrl: membershipPhotoUrl(person, organizationId),
  };
}

function membershipPhotoUrl(
  membership: OrganizationGroupBoardPersonRecord,
  organizationId: string,
): string | null {
  return membership.profile?.profilePhotoAsset
    ? organizationMediaContentUrl(organizationId, membership.profile.profilePhotoAsset.id)
    : userAvatarUrl(membership.user, organizationId);
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
