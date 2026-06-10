import { Injectable } from '@nestjs/common';
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
}
