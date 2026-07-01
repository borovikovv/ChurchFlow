import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationsRepository } from '../invitations/repositories/invitations.repository';
import type { OrganizationRole } from '@churchflow/db';
import type {
  CreateManualOrganizationMemberInput,
  OrganizationMembersAccessFilter,
  UpdateOrganizationMemberProfileInput,
} from '@churchflow/shared';
import { MembershipsRepository } from './repositories/memberships.repository';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly membershipsRepository: MembershipsRepository,
    private readonly invitationsRepository: InvitationsRepository,
  ) {}

  async listForOrganization(
    organizationId: string,
    actorUserId: string,
    access: OrganizationMembersAccessFilter,
  ) {
    const [members, pendingInvitations, actorMembership] = await Promise.all([
      this.membershipsRepository.listForOrganization(organizationId, access),
      this.invitationsRepository.listPendingForOrganization(organizationId),
      this.membershipsRepository.findActiveMembership(organizationId, actorUserId),
    ]);

    const canManageProfiles =
      actorMembership?.role === 'OWNER' || actorMembership?.role === 'ADMIN';

    return {
      actorRole: actorMembership?.role ?? null,
      actorMembershipId: actorMembership?.id ?? null,
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

        return {
          id: member.id,
          role: member.role,
          status: member.status,
          source: member.source,
          claimedAt: member.claimedAt,
          accountState,
          profile: member.profile
            ? { ...member.profile, notes: canManageProfiles ? member.profile.notes : null }
            : {
                displayName: member.user?.displayName ?? member.user?.email ?? 'Member',
                email: member.user?.email ?? null,
                phone: null,
                notes: null,
              },
          user: member.user
            ? {
                id: member.user.id,
                displayName: member.user.displayName,
                email: member.user.email,
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

  async createManualMember(
    organizationId: string,
    input: CreateManualOrganizationMemberInput,
    actorUserId: string,
  ) {
    try {
      return await this.membershipsRepository.createManualMember(
        organizationId,
        input,
        actorUserId,
      );
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
          'Only organization owners and admins can edit member profiles',
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
      return await this.membershipsRepository.removeMembership({
        organizationId,
        membershipId,
        actorUserId,
      });
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
}
