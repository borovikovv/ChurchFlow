import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationsRepository } from '../invitations/repositories/invitations.repository';
import type { OrganizationRole } from '@churchflow/db';
import { MembershipsRepository } from './repositories/memberships.repository';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly membershipsRepository: MembershipsRepository,
    private readonly invitationsRepository: InvitationsRepository,
  ) {}

  async listForOrganization(organizationId: string, actorUserId: string) {
    const [members, pendingInvitations, actorMembership] = await Promise.all([
      this.membershipsRepository.listForOrganization(organizationId),
      this.invitationsRepository.listPendingForOrganization(organizationId),
      this.membershipsRepository.findActiveMembership(organizationId, actorUserId),
    ]);

    return {
      actorRole: actorMembership?.role ?? null,
      actorMembershipId: actorMembership?.id ?? null,
      members,
      pendingInvitations,
    };
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
