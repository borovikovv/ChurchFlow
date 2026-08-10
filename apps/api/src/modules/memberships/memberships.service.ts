import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationsRepository } from '../invitations/repositories/invitations.repository';
import { NotificationsService } from '../notifications/notifications.service';
import type { OrganizationRole } from '@churchflow/db';
import type {
  CreateOrganizationMemberRelationshipInput,
  CreateManualOrganizationMemberInput,
  ImportOrganizationMembersCsvResult,
  MemberMinistry,
  OrganizationMembersAccessFilter,
  OrganizationMembersTypeFilter,
  UpdateOrganizationMemberProfileInput,
} from '@churchflow/shared';
import { parseMembersCsv } from './member-csv-import';
import { MembershipsRepository } from './repositories/memberships.repository';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly membershipsRepository: MembershipsRepository,
    private readonly invitationsRepository: InvitationsRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listForOrganization(
    organizationId: string,
    actorUserId: string,
    access: OrganizationMembersAccessFilter,
    type: OrganizationMembersTypeFilter,
    search: string,
    ministries: MemberMinistry[],
    page: number,
    pageSize: number,
    membershipId?: string,
  ) {
    const [membersPage, pendingInvitations, actorMembership] = await Promise.all([
      this.membershipsRepository.listForOrganization(
        organizationId,
        access,
        type,
        search,
        ministries,
        page,
        pageSize,
        membershipId,
      ),
      this.invitationsRepository.listPendingForOrganization(organizationId),
      this.membershipsRepository.findActiveMembership(organizationId, actorUserId),
    ]);
    const { candidates, members, page: currentPage, total } = membersPage;

    const canManageProfiles =
      actorMembership?.role === 'OWNER' || actorMembership?.role === 'ADMIN';

    return {
      actorRole: actorMembership?.role ?? null,
      actorMembershipId: actorMembership?.id ?? null,
      pagination: {
        page: currentPage,
        pageSize,
        total,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      },
      memberCandidates: candidates.map((candidate) => ({
        id: candidate.id,
        displayName:
          candidate.profile?.displayName ??
          candidate.user?.displayName ??
          candidate.user?.email ??
          'Member',
      })),
      members: members.map((member) => {
        const activeClaim = member.claims.find((claim) => claim.expiresAt.getTime() > Date.now());
        const accountState = member.user
          ? member.user.accounts.length > 0
            ? 'CLAIMED'
            : 'ACCOUNT_DISABLED'
          : activeClaim?.status === 'REQUESTED'
            ? 'CLAIM_REQUESTED'
            : activeClaim
              ? 'CLAIM_PENDING'
              : 'UNCLAIMED';

        const canViewProfile =
          canManageProfiles || (actorMembership ? actorMembership.id === member.id : false);

        return {
          id: member.id,
          role: member.role,
          status: member.status,
          source: member.source,
          ministries: member.ministries.map(({ ministry }) => ministry),
          claimedAt: member.claimedAt,
          accountState,
          profile: member.profile
            ? {
                ...member.profile,
                notes: canViewProfile ? member.profile.notes : null,
                biography: canViewProfile ? member.profile.biography : null,
                familyNotes: canViewProfile ? member.profile.familyNotes : null,
                photoUrl: member.user?.avatarUrl ?? null,
              }
            : {
                displayName: member.user?.displayName ?? member.user?.email ?? 'Member',
                email: member.user?.email ?? null,
                phone: null,
                notes: null,
                memberSince: null,
                birthday: null,
                anniversary: null,
                biography: null,
                familyNotes: null,
                profilePhotoAssetId: null,
                photoUrl: member.user?.avatarUrl ?? null,
              },
          user: member.user
            ? {
                id: member.user.id,
                displayName: member.user.displayName,
                email: member.user.email,
                baptizedAt: member.user.baptizedAt,
                baptismChurchName: member.user.baptismChurchName,
                platformRole: member.user.platformRole,
              }
            : null,
          activeClaim: activeClaim
            ? {
                ...activeClaim,
                requestedBy: canManageProfiles ? activeClaim.requestedBy : null,
              }
            : null,
        };
      }),
      pendingInvitations,
    };
  }

  async listRelationships(organizationId: string, membershipId: string, actorUserId: string) {
    const actor = await this.membershipsRepository.findActiveMembership(
      organizationId,
      actorUserId,
    );
    if (!actor || (!['OWNER', 'ADMIN'].includes(actor.role) && actor.id !== membershipId))
      throw new ForbiddenException(
        'Only organization owners, admins, and the member can view member relationships',
      );
    return this.membershipsRepository.listRelationships(organizationId, membershipId);
  }

  async createRelationship(
    organizationId: string,
    membershipId: string,
    input: CreateOrganizationMemberRelationshipInput,
    actorUserId: string,
  ) {
    try {
      return await this.membershipsRepository.createRelationship({
        organizationId,
        membershipId,
        ...input,
        actorUserId,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'ACTOR_CANNOT_MANAGE_MEMBERS')
        throw new ForbiddenException(
          'Only organization owners, admins, and the member can manage relationships',
        );
      if (code === 'MEMBERSHIP_NOT_FOUND')
        throw new NotFoundException('Organization member was not found');
      if (code === 'SELF_RELATIONSHIP' || code === 'RELATIONSHIP_EXISTS')
        throw new ConflictException(
          code === 'SELF_RELATIONSHIP'
            ? 'A member cannot be related to themselves'
            : 'Relationship already exists',
        );
      throw error;
    }
  }

  async deleteRelationship(organizationId: string, relationshipId: string, actorUserId: string) {
    try {
      return await this.membershipsRepository.deleteRelationship(
        organizationId,
        relationshipId,
        actorUserId,
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'ACTOR_CANNOT_MANAGE_MEMBERS')
        throw new ForbiddenException(
          'Only organization owners, admins, and the member can manage relationships',
        );
      if (error instanceof Error && error.message === 'RELATIONSHIP_NOT_FOUND')
        throw new NotFoundException('Relationship was not found');
      throw error;
    }
  }

  async createManualMember(
    organizationId: string,
    input: CreateManualOrganizationMemberInput,
    actorUserId: string,
  ) {
    try {
      const member = await this.membershipsRepository.createManualMember(
        organizationId,
        input,
        actorUserId,
      );
      await this.tryCreateAdminMembershipChangeNotifications({
        organizationId,
        actorUserId,
        type: 'MEMBER_ADDED',
        title: 'Member added',
        body: `${memberDisplayName(member)} was added to the organization.`,
        entityId: member.id,
      });

      return member;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'ORGANIZATION_NOT_ACTIVE') {
        throw new NotFoundException('Active organization was not found');
      }
      if (error instanceof Error && error.message === 'ACTOR_CANNOT_MANAGE_MEMBERS') {
        throw new ForbiddenException('Only organization owners and admins can create members');
      }
      throw error;
    }
  }

  async importMembersCsv(
    organizationId: string,
    csv: string,
    actorUserId: string,
  ): Promise<ImportOrganizationMembersCsvResult> {
    const parsed = parseMembersCsv(csv);
    if (parsed.totalRows === 0 && parsed.errors.length > 0) {
      const firstError = parsed.errors[0];
      throw new BadRequestException({
        code: 'CSV_IMPORT_INVALID',
        message: firstError?.message ?? 'CSV import failed',
        errors: parsed.errors,
      });
    }

    try {
      const members =
        parsed.rows.length > 0
          ? await this.membershipsRepository.importManualMembers(
              organizationId,
              parsed.rows,
              actorUserId,
            )
          : [];
      if (members.length > 0) {
        await this.tryCreateAdminMembershipChangeNotifications({
          organizationId,
          actorUserId,
          type: 'MEMBER_ADDED',
          title: 'Members imported',
          body: `${String(members.length)} members were imported to the organization.`,
          entityId: members[0]?.id ?? null,
          dedupeKey: `members-import:${actorUserId}:${String(Date.now())}`,
        });
      }

      return {
        createdCount: members.length,
        failedCount: new Set(parsed.errors.map((error) => error.row)).size,
        totalRows: parsed.totalRows,
        errors: parsed.errors,
        members: members.map((member) => ({
          ...member,
          role: member.role as 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER',
          source: member.source as 'EXISTING' | 'MANUAL' | 'INVITATION' | 'ORGANIZATION_APPROVAL',
          profile: {
            ...member.profile,
            birthday: member.profile.birthday?.toISOString() ?? null,
            anniversary: member.profile.anniversary?.toISOString() ?? null,
          },
        })),
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'ORGANIZATION_NOT_ACTIVE') {
        throw new NotFoundException('Active organization was not found');
      }
      if (error instanceof Error && error.message === 'ACTOR_CANNOT_MANAGE_MEMBERS') {
        throw new ForbiddenException('Only organization owners and admins can import members');
      }
      throw error;
    }
  }

  async updateProfile(
    organizationId: string,
    membershipId: string,
    input: UpdateOrganizationMemberProfileInput,
    actorUserId: string,
  ) {
    try {
      return await this.membershipsRepository.updateProfile(
        organizationId,
        membershipId,
        input,
        actorUserId,
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'ACTOR_CANNOT_MANAGE_MEMBERS') {
        throw new ForbiddenException(
          'Only organization owners, admins, and the member can edit member profiles',
        );
      }
      if (error instanceof Error && error.message === 'MEMBERSHIP_NOT_FOUND') {
        throw new NotFoundException('Organization member was not found');
      }
      throw error;
    }
  }

  async updateRole(
    organizationId: string,
    membershipId: string,
    role: OrganizationRole,
    actorUserId: string,
  ) {
    try {
      return await this.membershipsRepository.updateRole({
        organizationId,
        membershipId,
        role,
        actorUserId,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'ACTOR_NOT_OWNER') {
        throw new ForbiddenException('Only organization owners can change member roles');
      }
      if (error instanceof Error && error.message === 'MEMBERSHIP_NOT_ACTIVE') {
        throw new NotFoundException('Active membership was not found');
      }
      if (error instanceof Error && error.message === 'LAST_OWNER') {
        throw new ConflictException('Cannot downgrade the last organization owner');
      }
      if (error instanceof Error && error.message === 'UNCLAIMED_ELEVATED_ROLE') {
        throw new ConflictException('Connect Telegram before assigning an elevated role');
      }
      throw error;
    }
  }

  async removeMember(organizationId: string, membershipId: string, actorUserId: string) {
    const actorMembership = await this.membershipsRepository.findActiveMembership(
      organizationId,
      actorUserId,
    );
    if (!actorMembership || actorMembership.role !== 'OWNER') {
      throw new ForbiddenException('Only organization owners can remove members');
    }

    const targetMembership = await this.membershipsRepository.findActiveMembershipById(
      organizationId,
      membershipId,
    );
    if (!targetMembership) {
      throw new NotFoundException('Active membership was not found');
    }

    if (targetMembership.userId === actorUserId) {
      throw new ConflictException('Owners cannot remove their own membership');
    }

    try {
      const removed = await this.membershipsRepository.removeMembership({
        organizationId,
        membershipId,
        actorUserId,
      });
      if (removed) {
        await this.tryCreateAdminMembershipChangeNotifications({
          organizationId,
          actorUserId,
          type: 'MEMBER_REMOVED',
          title: 'Member removed',
          body: `${memberDisplayName(targetMembership)} was removed from the organization.`,
          entityId: removed.id,
        });
      }

      return removed;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'ACTOR_NOT_OWNER') {
        throw new ForbiddenException('Only organization owners can remove members');
      }
      if (error instanceof Error && error.message === 'LAST_OWNER') {
        throw new ConflictException('Cannot remove the last organization owner');
      }

      throw error;
    }
  }

  private async tryCreateAdminMembershipChangeNotifications(input: {
    organizationId: string;
    actorUserId: string;
    type: 'MEMBER_ADDED' | 'MEMBER_REMOVED';
    title: string;
    body: string;
    entityId: string | null;
    dedupeKey?: string;
  }) {
    try {
      const recipientMembershipIds = await this.membershipsRepository.listAdminMembershipIds(
        input.organizationId,
        input.actorUserId,
      );
      await this.notificationsService.createAdminMembershipChangeNotifications({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        recipientMembershipIds,
        type: input.type,
        preferenceKey: 'organizationUpdatesEnabled',
        title: input.title,
        body: input.body,
        url: `/dashboard/${input.organizationId}/members`,
        entityType: 'OrganizationMember',
        entityId: input.entityId,
        ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
        adminOnly: true,
      });
    } catch {
      return;
    }
  }
}

function memberDisplayName(member: {
  profile?: { displayName: string } | null;
  user?: { displayName: string | null; email: string | null } | null;
}) {
  return member.profile?.displayName ?? member.user?.displayName ?? member.user?.email ?? 'Member';
}
