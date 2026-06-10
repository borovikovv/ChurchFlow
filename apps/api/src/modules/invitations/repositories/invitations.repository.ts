import { Injectable } from '@nestjs/common';
import type { OrganizationRole, Prisma } from '@churchflow/db';
import { PrismaService } from '../../../prisma/prisma.service';

interface CreateOrRefreshPendingInput {
  organizationId: string;
  email: string;
  role: OrganizationRole;
  invitedByUserId: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class InvitationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveOrganization(organizationId: string) {
    return this.prisma.organization.findFirst({
      where: { id: organizationId, status: 'ACTIVE', deletedAt: null }
    });
  }

  async findActiveMembership(organizationId: string, userId: string) {
    return this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        status: 'ACTIVE',
        removedAt: null
      }
    });
  }

  async findMemberByEmail(organizationId: string, email: string) {
    return this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        status: 'ACTIVE',
        user: { email }
      }
    });
  }

  async createOrRefreshPending(input: CreateOrRefreshPendingInput) {
    const pending = await this.prisma.organizationInvitation.findFirst({
      where: {
        organizationId: input.organizationId,
        email: input.email,
        status: 'PENDING',
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (pending) {
      return this.prisma.organizationInvitation.update({
        where: { id: pending.id },
        data: {
          role: input.role,
          tokenHash: input.tokenHash,
          invitedByUserId: input.invitedByUserId,
          expiresAt: input.expiresAt
        }
      });
    }

    return this.prisma.organizationInvitation.create({
      data: {
        organizationId: input.organizationId,
        email: input.email,
        role: input.role,
        tokenHash: input.tokenHash,
        invitedByUserId: input.invitedByUserId,
        expiresAt: input.expiresAt
      }
    });
  }

  async findByTokenHash(tokenHash: string) {
    return this.prisma.organizationInvitation.findUnique({
      where: { tokenHash },
      include: { organization: true }
    });
  }

  async findUserForInvitation(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerified: true }
    });
  }

  async accept(invitationId: string, userId: string, organizationId: string, role: OrganizationRole) {
    return this.prisma.$transaction(async (tx) => {
      const existingMember = await tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId } }
      });

      if (existingMember && existingMember.status === 'ACTIVE') {
        throw new Error('User is already a member of this organization');
      }

      const memberData: Prisma.OrganizationMemberUncheckedCreateInput = {
        organizationId,
        userId,
        role,
        status: 'ACTIVE'
      };

      if (existingMember) {
        await tx.organizationMember.update({
          where: { id: existingMember.id },
          data: {
            role,
            status: 'ACTIVE',
            removedAt: null,
            joinedAt: new Date()
          }
        });
      } else {
        await tx.organizationMember.create({ data: memberData });
      }

      await tx.organizationInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date()
        }
      });

      return { organizationId };
    });
  }

  async revoke(organizationId: string, invitationId: string) {
    const invitation = await this.prisma.organizationInvitation.findFirst({
      where: { id: invitationId, organizationId, status: 'PENDING', acceptedAt: null, revokedAt: null }
    });
    if (!invitation) {
      return null;
    }

    return this.prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date()
      }
    });
  }

  async resend(organizationId: string, invitationId: string, tokenHash: string, expiresAt: Date) {
    const invitation = await this.prisma.organizationInvitation.findFirst({
      where: { id: invitationId, organizationId, status: 'PENDING', acceptedAt: null, revokedAt: null }
    });
    if (!invitation) {
      return null;
    }

    return this.prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { tokenHash, expiresAt },
      include: { organization: true }
    });
  }

  async listPendingForOrganization(organizationId: string) {
    return this.prisma.organizationInvitation.findMany({
      where: {
        organizationId,
        status: 'PENDING',
        acceptedAt: null,
        revokedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
