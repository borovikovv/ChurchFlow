import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ApproveOrganizationRequestInput,
  CreateOrganizationRequestInput,
  RejectOrganizationRequestInput
} from '@churchflow/shared';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { InvitationsService } from '../invitations/invitations.service';
import { OrganizationRequestsRepository } from './repositories/organization-requests.repository';

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

@Injectable()
export class OrganizationRequestsService {
  constructor(
    private readonly organizationRequestsRepository: OrganizationRequestsRepository,
    private readonly invitationsService: InvitationsService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService
  ) {}

  async create(input: CreateOrganizationRequestInput) {
    const request = await this.organizationRequestsRepository.create(input);
    await this.emailService.sendOrganizationRequestAdminEmail({
      requestId: request.id,
      organizationName: request.organizationName,
      contactName: request.contactName,
      contactEmail: request.contactEmail,
      contactPhone: request.contactPhone,
      message: request.message
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
    const organizationSlug = input.organizationSlug ?? request.organizationSlug ?? slugify(organizationName);
    const invitation = this.invitationsService.createRawInvitationToken();

    const result = await this.organizationRequestsRepository.approve({
      id,
      organizationName,
      organizationSlug,
      actorUserId,
      invitationTokenHash: invitation.tokenHash
    });

    await this.emailService.sendOrganizationInvitationEmail({
      email: request.contactEmail,
      organizationName: result.organization.name,
      role: 'OWNER',
      token: invitation.rawToken,
      expiresAt: result.invitation.expiresAt
    });

    await this.auditService.record({
      organizationId: result.organization.id,
      actorUserId,
      action: 'APPROVE',
      entityType: 'OrganizationRequest',
      entityId: id,
      metadata: {
        createdOrganizationId: result.organization.id,
        invitationId: result.invitation.id
      }
    });

    return result;
  }

  async reject(id: string, input: RejectOrganizationRequestInput, actorUserId: string) {
    const request = await this.organizationRequestsRepository.reject(id, input.rejectionReason, actorUserId);
    if (!request) {
      throw new NotFoundException('Pending organization request was not found');
    }

    await this.emailService.sendOrganizationRequestRejectedEmail({
      email: request.contactEmail,
      organizationName: request.organizationName,
      rejectionReason: input.rejectionReason
    });

    await this.auditService.record({
      actorUserId,
      action: 'REJECT',
      entityType: 'OrganizationRequest',
      entityId: id,
      metadata: { rejectionReason: input.rejectionReason }
    });

    return request;
  }
}
