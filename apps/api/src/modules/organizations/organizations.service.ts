import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import type { z } from 'zod';
import { createOrganizationSchema } from '@churchflow/shared';
import { AuditService } from '../audit/audit.service';
import { OrganizationsRepository } from './repositories/organizations.repository';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(input: z.infer<typeof createOrganizationSchema>, ownerUserId: string) {
    try {
      return await this.organizationsRepository.create(input, ownerUserId);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'ORGANIZATION_OWNER_INACTIVE') {
        throw new ConflictException('Organization owner is no longer active');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Organization slug is already in use');
      }
      throw error;
    }
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

  private async changeStatus(
    id: string,
    actorUserId: string,
    action: 'ARCHIVE' | 'SUSPEND' | 'RESTORE' | 'DELETE',
  ) {
    const organization = await this.organizationsRepository
      .changeStatus(id, action)
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new NotFoundException('Organization was not found');
        }
        throw error;
      });

    await this.auditService.record({
      organizationId: organization.id,
      actorUserId,
      action,
      entityType: 'Organization',
      entityId: organization.id,
      metadata: { status: organization.status },
    });

    return organization;
  }
}
