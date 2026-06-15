import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InvitationsRepository } from '../invitations/repositories/invitations.repository';
import { MembershipsRepository } from './repositories/memberships.repository';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly membershipsRepository: MembershipsRepository,
    private readonly invitationsRepository: InvitationsRepository
  ) {}

  async listForOrganization(organizationId: string) {
    const [members, pendingInvitations] = await Promise.all([
      this.membershipsRepository.listForOrganization(organizationId),
      this.invitationsRepository.listPendingForOrganization(organizationId)
    ]);

    return { members, pendingInvitations };
  }

  async removeMember(organizationId: string, membershipId: string, actorUserId: string) {
    const actorMembership = await this.membershipsRepository.findActiveMembership(
      organizationId,
      actorUserId
    );
    if (!actorMembership || actorMembership.role !== 'OWNER') {
      throw new ForbiddenException('Only organization owners can remove members');
    }

    const targetMembership = await this.membershipsRepository.findActiveMembershipById(
      organizationId,
      membershipId
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
        actorUserId
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'LAST_OWNER') {
        throw new ConflictException('Cannot remove the last organization owner');
      }

      throw error;
    }
  }
}
