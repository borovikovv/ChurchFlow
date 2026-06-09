import { Injectable } from '@nestjs/common';
import { MembershipsRepository } from './repositories/memberships.repository';

@Injectable()
export class MembershipsService {
  constructor(private readonly membershipsRepository: MembershipsRepository) {}

  async listForOrganization(organizationId: string) {
    return this.membershipsRepository.listForOrganization(organizationId);
  }
}
