import { Injectable } from '@nestjs/common';
import { Prisma, type OrganizationRequestStatus } from '@churchflow/db';
import type { CreateOrganizationRequestInput } from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';

interface ApproveOrganizationRequestInput {
  id: string;
  organizationName: string;
  organizationSlug: string;
  actorUserId: string;
  staleBefore: Date;
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

export interface OrganizationRequestListItem {
  id: string;
  organizationName: string;
  contactName: string;
  contactEmail: string | null;
  contactTelegramId: string;
  contactTelegramUsername: string | null;
  status: OrganizationRequestStatus;
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

@Injectable()
export class OrganizationRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateOrganizationRequestInput,
    requestedByUserId: string,
    staleBefore: Date,
  ): Promise<CreatedOrganizationRequest> {
    return this.prisma.$transaction(async (tx) => {
      const requester = await tx.user.findFirst({
        where: {
          id: requestedByUserId,
          deletedAt: null,
          accounts: { some: { provider: 'telegram', deletedAt: null } },
        },
        select: { id: true },
      });
      if (!requester) {
        throw new Error('ORGANIZATION_REQUEST_REQUESTER_INACTIVE');
      }

      await this.expireStalePending(tx, staleBefore, { requestedByUserId });
      const request = await tx.organizationRequest.create({
        data: {
          organizationName: input.organizationName,
          organizationSlug: input.organizationSlug ?? null,
          contactName: input.contactName,
          contactEmail: input.contactEmail ?? null,
          requestedByUserId,
          contactPhone: input.contactPhone ?? null,
          message: input.message ?? null,
        },
        include: {
          requestedBy: {
            include: {
              accounts: {
                where: { provider: 'telegram', deletedAt: null },
                select: { providerAccountId: true },
                take: 1,
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: requestedByUserId,
          action: 'CREATE',
          entityType: 'OrganizationRequest',
          entityId: request.id,
          metadata: { source: 'organization_onboarding' },
        },
      });

      return {
        id: request.id,
        organizationName: request.organizationName,
        contactName: request.contactName,
        contactEmail: request.contactEmail,
        contactPhone: request.contactPhone,
        message: request.message,
        requestedBy: request.requestedBy
          ? {
              accounts: request.requestedBy.accounts.map((account) => ({
                providerAccountId: account.providerAccountId,
              })),
            }
          : null,
      };
    });
  }

  async expireStaleAndFindPending(requestedByUserId: string, staleBefore: Date) {
    return this.prisma.$transaction(async (tx) => {
      await this.expireStalePending(tx, staleBefore, { requestedByUserId });
      return tx.organizationRequest.findFirst({
        where: { requestedByUserId, status: 'PENDING' },
        select: { id: true },
      });
    });
  }

  async listForRequester(
    requestedByUserId: string,
    staleBefore: Date,
  ): Promise<OrganizationRequestDetail[]> {
    await this.expireStalePending(this.prisma, staleBefore, { requestedByUserId });
    const requests = await this.prisma.organizationRequest.findMany({
      where: { requestedByUserId },
      orderBy: { createdAt: 'desc' },
      include: this.organizationRequestInclude(),
    });

    return requests.map((request) => this.toDetail(request));
  }

  async list(
    status: string | undefined,
    staleBefore: Date,
  ): Promise<OrganizationRequestListItem[]> {
    await this.expireStalePending(this.prisma, staleBefore);
    const requests = await this.prisma.organizationRequest.findMany({
      ...(status ? { where: { status: status as OrganizationRequestStatus } } : {}),
      orderBy: { createdAt: 'desc' },
      include: this.organizationRequestInclude(),
    });

    return requests.map((request) => this.toListItem(request));
  }

  async findById(id: string, staleBefore: Date): Promise<OrganizationRequestDetail | null> {
    await this.expireStalePending(this.prisma, staleBefore, { id });
    const request = await this.prisma.organizationRequest.findUnique({
      where: { id },
      include: this.organizationRequestInclude(),
    });

    if (!request) {
      return null;
    }

    return this.toDetail(request);
  }

  async findOrganizationBySlug(slug: string) {
    return this.prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
  }

  async approve(input: ApproveOrganizationRequestInput): Promise<ApprovedOrganizationRequest> {
    const result = await this.prisma.$transaction(async (tx) => {
      await this.expireStalePending(tx, input.staleBefore, { id: input.id });
      const claimed = await tx.organizationRequest.updateMany({
        where: { id: input.id, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          reviewedByUserId: input.actorUserId,
        },
      });
      if (claimed.count !== 1) {
        throw new Error('ORGANIZATION_REQUEST_NOT_PENDING');
      }

      const request = await tx.organizationRequest.findUniqueOrThrow({
        where: { id: input.id },
      });
      if (!request.requestedByUserId) {
        throw new Error('ORGANIZATION_REQUEST_MISSING_REQUESTER');
      }
      const requester = await tx.user.findFirst({
        where: {
          id: request.requestedByUserId,
          deletedAt: null,
          accounts: { some: { provider: 'telegram', deletedAt: null } },
        },
        select: { id: true },
      });
      if (!requester) {
        throw new Error('ORGANIZATION_REQUEST_REQUESTER_INACTIVE');
      }

      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: input.organizationSlug,
          description: request.message,
          status: 'ACTIVE',
          website: {
            create: {
              title: input.organizationName,
              description: request.message,
            },
          },
        },
      });

      const membership = await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: request.requestedByUserId,
          role: 'OWNER',
          status: 'ACTIVE',
          source: 'ORGANIZATION_APPROVAL',
          claimedAt: new Date(),
          createdByUserId: input.actorUserId,
          profile: {
            create: {
              displayName: request.contactName,
              email: request.contactEmail,
              phone: request.contactPhone,
            },
          },
        },
      });

      await tx.organizationRequest.update({
        where: { id: input.id },
        data: {
          createdOrganizationId: organization.id,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          actorUserId: input.actorUserId,
          action: 'CREATE',
          entityType: 'OrganizationMember',
          entityId: membership.id,
          metadata: {
            userId: request.requestedByUserId,
            role: 'OWNER',
            source: 'organization_request_approval',
          },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          actorUserId: input.actorUserId,
          action: 'APPROVE',
          entityType: 'OrganizationRequest',
          entityId: request.id,
          metadata: {
            createdOrganizationId: organization.id,
            ownerMembershipId: membership.id,
            requestedByUserId: request.requestedByUserId,
          },
        },
      });

      return {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        },
        membership: {
          id: membership.id,
        },
      };
    });

    return result;
  }

  async reject(
    id: string,
    rejectionReason: string,
    actorUserId: string,
    staleBefore: Date,
  ): Promise<OrganizationRequestDetail | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.expireStalePending(tx, staleBefore, { id });
      const rejected = await tx.organizationRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          reviewedByUserId: actorUserId,
          rejectionReason,
        },
      });
      if (rejected.count !== 1) {
        return null;
      }

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'REJECT',
          entityType: 'OrganizationRequest',
          entityId: id,
          metadata: { rejectionReason },
        },
      });

      const request = await tx.organizationRequest.findUnique({
        where: { id },
        include: this.organizationRequestInclude(),
      });

      return request ? this.toDetail(request) : null;
    });
  }

  private async expireStalePending(
    client: Pick<PrismaService, 'organizationRequest'>,
    staleBefore: Date,
    scope: { requestedByUserId?: string; id?: string } = {},
  ): Promise<void> {
    await client.organizationRequest.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lte: staleBefore },
        ...(scope.requestedByUserId ? { requestedByUserId: scope.requestedByUserId } : {}),
        ...(scope.id ? { id: scope.id } : {}),
      },
      data: { status: 'EXPIRED' },
    });
  }

  private organizationRequestInclude() {
    return {
      createdOrganization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      requestedBy: {
        include: {
          accounts: {
            where: { provider: 'telegram', deletedAt: null },
            select: { providerAccountId: true },
            take: 1,
          },
        },
      },
    } satisfies Prisma.OrganizationRequestInclude;
  }

  private toDetail(request: {
    id: string;
    organizationName: string;
    organizationSlug: string | null;
    contactName: string;
    contactEmail: string | null;
    contactTelegramId: string | null;
    contactTelegramUsername: string | null;
    contactPhone: string | null;
    message: string | null;
    status: OrganizationRequestStatus;
    rejectionReason: string | null;
    requestedByUserId: string | null;
    createdAt: Date;
    requestedBy: { accounts: Array<{ providerAccountId: string }> } | null;
    createdOrganization: { id: string; name: string; slug: string } | null;
  }): OrganizationRequestDetail {
    return {
      ...this.toListItem(request),
      organizationSlug: request.organizationSlug,
      contactPhone: request.contactPhone,
      message: request.message,
      rejectionReason: request.rejectionReason,
      requestedByUserId: request.requestedByUserId,
      createdOrganization: request.createdOrganization,
    };
  }

  private toListItem(request: {
    id: string;
    organizationName: string;
    contactName: string;
    contactEmail: string | null;
    contactTelegramId: string | null;
    contactTelegramUsername: string | null;
    status: OrganizationRequestStatus;
    createdAt: Date;
    requestedBy: {
      accounts: Array<{
        providerAccountId: string;
      }>;
    } | null;
  }): OrganizationRequestListItem {
    return {
      id: request.id,
      organizationName: request.organizationName,
      contactName: request.contactName,
      contactEmail: request.contactEmail,
      contactTelegramId:
        request.contactTelegramId ??
        request.requestedBy?.accounts[0]?.providerAccountId ??
        'linked Telegram account',
      contactTelegramUsername: request.contactTelegramUsername,
      status: request.status,
      createdAt: request.createdAt,
    };
  }
}
