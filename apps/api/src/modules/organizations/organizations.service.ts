import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type OrganizationStatus } from '@churchflow/db';
import type { z } from 'zod';
import {
  createOrganizationSchema,
  type AdminOrganizationWorkspaceStatus,
  type AdminOrganizationWorkspaceView,
  type UpdateOrganizationInput,
} from '@churchflow/shared';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { OrganizationRequestsRepository } from '../organization-requests/repositories/organization-requests.repository';
import { OrganizationsRepository } from './repositories/organizations.repository';

type WorkspaceOrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  subtitle?: string;
  itemType: 'organization' | 'request';
  _count?: {
    members: number;
    invitations: number;
  };
  role?: string;
};

type OrganizationWorkspaceSource = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  _count?: {
    members: number;
    invitations: number;
  };
  role?: string;
};

const ORGANIZATION_STATUSES = ['ACTIVE', 'SUSPENDED', 'ARCHIVED', 'DELETED'] as const;
const REQUEST_STATUSES = ['PENDING', 'REJECTED', 'EXPIRED'] as const;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly organizationRequestsRepository: OrganizationRequestsRepository,
    private readonly auditService: AuditService,
    private readonly entitlementsService: EntitlementsService,
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

  async listMine(userId: string) {
    const organizations = await this.organizationsRepository.listMine(userId);
    const now = new Date();

    // Entitlements travel with the organization list so the dashboard shell can reflect a
    // restriction on every page without a fetch of its own per route.
    return organizations.map(({ subscription, ...organization }) => ({
      ...organization,
      subscriptionStatus: subscription?.status ?? null,
      entitlements: this.entitlementsService.resolve(subscription, now),
    }));
  }

  async listAdmin(status?: string) {
    return this.organizationsRepository.listAdmin(status);
  }

  async listWorkspace(
    userId: string,
    view?: AdminOrganizationWorkspaceView,
    status?: AdminOrganizationWorkspaceStatus,
  ): Promise<WorkspaceOrganizationRow[]> {
    const platformRole = await this.organizationsRepository.findPlatformRole(userId);
    const isPlatformAdmin = platformRole === 'ADMIN' || platformRole === 'SUPER_ADMIN';
    const effectiveView: AdminOrganizationWorkspaceView =
      isPlatformAdmin && view === 'all' ? 'all' : 'mine';
    const organizationStatus = this.toOrganizationStatus(status);
    const requestStatus = this.toRequestStatus(status);

    if (effectiveView === 'all') {
      const [organizations, requests] = await Promise.all([
        this.organizationsRepository.listAdmin(organizationStatus),
        this.organizationRequestsRepository.list(
          requestStatus,
          this.organizationRequestStaleBefore(),
        ),
      ]);

      return [
        ...organizations.map((organization) => this.mapOrganizationRow(organization)),
        ...requests
          .filter((request) => this.isDisplayedRequestStatus(request.status))
          .map((request) => this.mapRequestRow(request)),
      ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    }

    const [organizations, requests] = await Promise.all([
      this.organizationsRepository.listMineAdmin(userId, organizationStatus),
      this.organizationRequestsRepository.listForRequester(
        userId,
        this.organizationRequestStaleBefore(),
      ),
    ]);

    return [
      ...organizations.map((organization) => this.mapOrganizationRow(organization)),
      ...requests
        .filter(
          (request) =>
            this.isDisplayedRequestStatus(request.status) &&
            (!requestStatus || request.status === requestStatus),
        )
        .map((request) => this.mapRequestRow(request)),
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getAdmin(id: string) {
    const organization = await this.organizationsRepository.findAdminById(id);
    if (!organization) {
      throw new NotFoundException('Organization was not found');
    }

    return organization;
  }

  /**
   * Only reachable through the platform-admin routes. No organization-scoped endpoint accepts
   * `isExempt`, so an owner or organization admin has no path to granting it to themselves.
   */
  async grantBillingExemption(id: string, actorUserId: string, reason: string) {
    return this.setBillingExemption(id, actorUserId, reason);
  }

  async revokeBillingExemption(id: string, actorUserId: string) {
    return this.setBillingExemption(id, actorUserId, null);
  }

  private async setBillingExemption(id: string, actorUserId: string, reason: string | null) {
    try {
      return await this.organizationsRepository.setBillingExemption({
        organizationId: id,
        actorUserId,
        reason,
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Organization was not found');
      }

      throw error;
    }
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

  async update(id: string, input: UpdateOrganizationInput, actorUserId: string) {
    const organization = await this.organizationsRepository.findActiveById(id);
    if (!organization) {
      throw new NotFoundException('Organization was not found');
    }

    const actorMembership = await this.organizationsRepository.findOrganizationManager(
      id,
      actorUserId,
    );
    if (!actorMembership) {
      throw new ForbiddenException(
        'Only organization owners and admins can update organization details',
      );
    }

    try {
      return await this.organizationsRepository.update(id, input, actorUserId);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'ORGANIZATION_NOT_FOUND') {
        throw new NotFoundException('Organization was not found');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Organization slug is already in use');
      }
      throw error;
    }
  }

  private organizationRequestStaleBefore(): Date {
    return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  private mapOrganizationRow(organization: OrganizationWorkspaceSource): WorkspaceOrganizationRow {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      createdAt: organization.createdAt.toISOString(),
      itemType: 'organization',
      ...(organization._count ? { _count: organization._count } : {}),
      ...(organization.role ? { role: organization.role } : {}),
    };
  }

  private mapRequestRow(
    request:
      | Awaited<ReturnType<OrganizationRequestsRepository['list']>>[number]
      | Awaited<ReturnType<OrganizationRequestsRepository['listForRequester']>>[number],
  ): WorkspaceOrganizationRow {
    return {
      id: request.id,
      name: request.organizationName,
      slug:
        'organizationSlug' in request
          ? (request.organizationSlug ?? 'Organization request')
          : 'Organization request',
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      subtitle: `Requested by ${request.contactName}`,
      itemType: 'request',
    };
  }

  private isDisplayedRequestStatus(status: string): status is (typeof REQUEST_STATUSES)[number] {
    return REQUEST_STATUSES.includes(status as (typeof REQUEST_STATUSES)[number]);
  }

  private toOrganizationStatus(
    status?: AdminOrganizationWorkspaceStatus,
  ): OrganizationStatus | undefined {
    return ORGANIZATION_STATUSES.includes(status as OrganizationStatus)
      ? (status as OrganizationStatus)
      : undefined;
  }

  private toRequestStatus(
    status?: AdminOrganizationWorkspaceStatus,
  ): 'PENDING' | 'REJECTED' | 'EXPIRED' | undefined {
    return REQUEST_STATUSES.includes(status as (typeof REQUEST_STATUSES)[number])
      ? (status as (typeof REQUEST_STATUSES)[number])
      : undefined;
  }

  private async changeStatus(
    id: string,
    actorUserId: string,
    action: 'ARCHIVE' | 'SUSPEND' | 'RESTORE' | 'DELETE',
  ) {
    const organization = await this.organizationsRepository
      .changeStatus(id, action)
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2025') {
            throw new NotFoundException('Organization was not found');
          }
          // Видалення звільняє slug, тож поки організація лежала видаленою,
          // ім'я могли зайняти. Відновити її під тим самим slug уже не можна.
          if (error.code === 'P2002' && action === 'RESTORE') {
            throw new ConflictException(
              'Organization slug is already taken by another organization',
            );
          }
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
