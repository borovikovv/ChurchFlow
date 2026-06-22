import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import type {
  ApproveOrganizationRequestInput,
  CreateOrganizationRequestInput,
  RejectOrganizationRequestInput,
} from '@churchflow/shared';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { OrganizationRequestsRepository } from './repositories/organization-requests.repository';

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export interface CreatedOrganizationRequest {
  id: string;
  organizationName: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  message: string | null;
  requestedBy: {
    accounts: Array<{
      providerAccountId: string;
    }>;
  } | null;
}

export interface OrganizationRequestForApproval {
  status: string;
  organizationName: string;
  organizationSlug: string | null;
  requestedByUserId: string | null;
}

export interface OrganizationRequestListItem {
  id: string;
  organizationName: string;
  contactName: string;
  contactEmail: string | null;
  contactTelegramId: string;
  contactTelegramUsername: string | null;
  status: string;
  createdAt: Date;
}

export interface OrganizationRequestDetail extends OrganizationRequestListItem {
  organizationSlug: string | null;
  contactPhone: string | null;
  message: string | null;
  rejectionReason: string | null;
  requestedByUserId: string | null;
  createdOrganization: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface RejectedOrganizationRequest {
  organizationName: string;
  contactEmail: string | null;
}

export interface ApprovedOrganizationRequest {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  membership: {
    id: string;
  };
}

interface OrganizationRequestsRepositoryPort {
  create(
    input: CreateOrganizationRequestInput,
    requestedByUserId: string,
  ): Promise<CreatedOrganizationRequest>;
  list(status?: string): Promise<OrganizationRequestListItem[]>;
  findById(id: string): Promise<OrganizationRequestDetail | null>;
  findOrganizationBySlug(slug: string): Promise<{ id: string } | null>;
  approve(input: {
    id: string;
    organizationName: string;
    organizationSlug: string;
    actorUserId: string;
  }): Promise<ApprovedOrganizationRequest>;
  reject(
    id: string,
    rejectionReason: string,
    actorUserId: string,
  ): Promise<RejectedOrganizationRequest | null>;
}

@Injectable()
export class OrganizationRequestsService {
  constructor(
    @Inject(OrganizationRequestsRepository)
    private readonly organizationRequestsRepository: OrganizationRequestsRepositoryPort,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateOrganizationRequestInput, requestedByUserId: string) {
    const request = await this.organizationRequestsRepository.create(input, requestedByUserId);
    const requestedTelegramAccountId: string =
      request.requestedBy === null
        ? 'linked Telegram account'
        : (request.requestedBy.accounts[0]?.providerAccountId ?? 'linked Telegram account');

    await this.emailService.sendOrganizationRequestAdminEmail({
      requestId: request.id,
      organizationName: request.organizationName,
      contactName: request.contactName,
      contactEmail: request.contactEmail,
      contactTelegramId: requestedTelegramAccountId,
      contactTelegramUsername: null,
      contactPhone: request.contactPhone,
      message: request.message,
    });

    return request;
  }

  async list(status?: string) {
    return this.organizationRequestsRepository.list(status);
  }

  async get(id: string) {
    const request = await this.organizationRequestsRepository.findById(id);
    if (!request) {
      throw new NotFoundException('Organization request was not found');
    }

    return request;
  }

  async approve(id: string, input: ApproveOrganizationRequestInput, actorUserId: string) {
    const request = await this.organizationRequestsRepository.findById(id);
    if (!request) {
      throw new NotFoundException('Organization request was not found');
    }

    if (request.status !== 'PENDING') {
      throw new ConflictException('Only pending organization requests can be approved');
    }

    const organizationName = input.organizationName ?? request.organizationName;
    const organizationSlug =
      input.organizationSlug ?? request.organizationSlug ?? slugify(organizationName);
    const existingOrganization =
      await this.organizationRequestsRepository.findOrganizationBySlug(organizationSlug);
    if (existingOrganization) {
      throw new ConflictException('Organization slug is already in use');
    }

    const result: ApprovedOrganizationRequest = await this.approveRequestTransaction({
      id,
      organizationName,
      organizationSlug,
      actorUserId,
    });
    const createdOrganizationId: string = result.organization.id;
    const ownerMembershipId: string = result.membership.id;

    await this.auditService.record({
      organizationId: createdOrganizationId,
      actorUserId,
      action: 'APPROVE',
      entityType: 'OrganizationRequest',
      entityId: id,
      metadata: {
        createdOrganizationId,
        ownerMembershipId,
        requestedByUserId: request.requestedByUserId,
      },
    });

    return result;
  }

  private async approveRequestTransaction(input: {
    id: string;
    organizationName: string;
    organizationSlug: string;
    actorUserId: string;
  }): Promise<ApprovedOrganizationRequest> {
    try {
      return await this.organizationRequestsRepository.approve(input);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'ORGANIZATION_REQUEST_NOT_PENDING') {
        throw new ConflictException('Only pending organization requests can be approved');
      }

      if (error instanceof Error && error.message === 'ORGANIZATION_REQUEST_MISSING_REQUESTER') {
        throw new ConflictException('Organization request is missing authenticated requester');
      }

      if (error instanceof Error && error.message === 'ORGANIZATION_REQUEST_REQUESTER_INACTIVE') {
        throw new ConflictException('Organization request requester is no longer active');
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Organization slug or invitation token is already in use');
      }

      throw error;
    }
  }

  async reject(id: string, input: RejectOrganizationRequestInput, actorUserId: string) {
    const request = await this.organizationRequestsRepository.reject(
      id,
      input.rejectionReason,
      actorUserId,
    );
    if (!request) {
      throw new NotFoundException('Pending organization request was not found');
    }

    if (request.contactEmail) {
      await this.emailService.sendOrganizationRequestRejectedEmail({
        email: request.contactEmail,
        organizationName: request.organizationName,
        rejectionReason: input.rejectionReason,
      });
    }

    await this.auditService.record({
      actorUserId,
      action: 'REJECT',
      entityType: 'OrganizationRequest',
      entityId: id,
      metadata: { rejectionReason: input.rejectionReason },
    });

    return request;
  }
}
