import { Injectable, NotFoundException } from '@nestjs/common';
import type { z } from 'zod';
import { createOrganizationSchema } from '@churchflow/shared';
import { AuditService } from '../audit/audit.service';
import { OrganizationsRepository } from './repositories/organizations.repository';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly auditService: AuditService
  ) {}

  async create(input: z.infer<typeof createOrganizationSchema>, ownerUserId: string) {
    return this.organizationsRepository.create(input, ownerUserId);
  }

  async listAdmin(status?: string) {
    return this.organizationsRepository.listAdmin(status);
  }

  async getAdmin(id: string) {
    const organization = await this.organizationsRepository.findAdminById(id);
    if (!organization) {
      throw new NotFoundException('Organization was not found');
    }

    return organization;
  }

  async archive(id: string, actorUserId: string) {
    return this.changeStatus(id, actorUserId, 'ARCHIVE');
  }

  async suspend(id: string, actorUserId: string) {
    return this.changeStatus(id, actorUserId, 'SUSPEND');
  }

  async restore(id: string, actorUserId: string) {
    return this.changeStatus(id, actorUserId, 'RESTORE');
  }

  async deleteSoft(id: string, actorUserId: string) {
    return this.changeStatus(id, actorUserId, 'DELETE');
  }

  private async changeStatus(id: string, actorUserId: string, action: 'ARCHIVE' | 'SUSPEND' | 'RESTORE' | 'DELETE') {
    const organization = await this.organizationsRepository.changeStatus(id, action);
    if (!organization) {
      throw new NotFoundException('Organization was not found');
    }

    await this.auditService.record({
      organizationId: organization.id,
      actorUserId,
      action,
      entityType: 'Organization',
      entityId: organization.id,
      metadata: { status: organization.status }
    });

    return organization;
  }
}
