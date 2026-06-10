import { Injectable } from '@nestjs/common';
import type { OrganizationRequestStatus } from '@churchflow/db';
import type { CreateOrganizationRequestInput } from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';

interface ApproveOrganizationRequestInput {
  id: string;
  organizationName: string;
  organizationSlug: string;
  actorUserId: string;
  invitationTokenHash: string;
}

@Injectable()
export class OrganizationRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateOrganizationRequestInput) {
    return this.prisma.organizationRequest.create({
      data: {
        organizationName: input.organizationName,
        organizationSlug: input.organizationSlug ?? null,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone ?? null,
        message: input.message ?? null
      }
    });
  }

  async list(status?: string) {
    return this.prisma.organizationRequest.findMany({
      ...(status ? { where: { status: status as OrganizationRequestStatus } } : {}),
      orderBy: { createdAt: 'desc' },
      include: { createdOrganization: true, reviewedBy: true }
    });
  }

  async findById(id: string) {
    return this.prisma.organizationRequest.findUnique({
      where: { id },
      include: { createdOrganization: true, reviewedBy: true }
    });
  }

  async approve(input: ApproveOrganizationRequestInput) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.organizationRequest.findFirstOrThrow({
        where: { id: input.id, status: 'PENDING' }
      });
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: input.organizationSlug,
          description: request.message,
          status: 'ACTIVE',
          website: {
            create: {
              title: input.organizationName,
              description: request.message
            }
          }
        }
      });

      const invitation = await tx.organizationInvitation.create({
        data: {
          organizationId: organization.id,
          email: request.contactEmail,
          role: 'OWNER',
          tokenHash: input.invitationTokenHash,
          invitedByUserId: input.actorUserId,
          expiresAt
        }
      });

      await tx.organizationRequest.update({
        where: { id: input.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          reviewedByUserId: input.actorUserId,
          createdOrganizationId: organization.id
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          actorUserId: input.actorUserId,
          action: 'INVITE',
          entityType: 'OrganizationInvitation',
          entityId: invitation.id,
          metadata: { email: request.contactEmail, role: 'OWNER', source: 'organization_request_approval' }
        }
      });

      return { organization, invitation };
    });
  }

  async reject(id: string, rejectionReason: string, actorUserId: string) {
    const request = await this.prisma.organizationRequest.findFirst({
      where: { id, status: 'PENDING' }
    });
    if (!request) {
      return null;
    }

    return this.prisma.organizationRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        reviewedByUserId: actorUserId,
        rejectionReason
      }
    });
  }
}
