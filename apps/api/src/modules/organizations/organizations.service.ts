import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { createOrganizationSchema } from '@churchflow/shared';
import { OrganizationsRepository } from './repositories/organizations.repository';

@Injectable()
export class OrganizationsService {
  constructor(private readonly organizationsRepository: OrganizationsRepository) {}

  async create(input: z.infer<typeof createOrganizationSchema>, ownerUserId: string) {
    return this.organizationsRepository.create(input, ownerUserId);
  }
}
