import { Injectable } from '@nestjs/common';
import type {
  InvitationMode,
  InvitationTargetProvider,
  OrganizationRole,
  Prisma,
} from '@churchflow/db';
import { PrismaService } from '../../../prisma/prisma.service';

interface CreateOrRefreshPendingInput {
  organizationId: string;
  mode: InvitationMode;
  targetProvider: InvitationTargetProvider | undefined;
  targetProviderAccountId: string | undefined;
  targetDisplay: string | undefined;
  email: string | undefined;
  role: OrganizationRole;
  invitedByUserId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface InvitationOrganizationSummary {
  id: string;
  name: string;
}

export interface InvitationWithOrganization {
  id: string;
  organizationId: string;
  email: string | null;
  mode: InvitationMode;
  targetProvider: InvitationTargetProvider | null;
  targetProviderAccountId: string | null;
  targetDisplay: string | null;
  role: OrganizationRole;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  organization: InvitationOrganizationSummary;
}

@Injectable()
export class InvitationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveOrganization(organizationId: string) {
    return this.prisma.organization.findFirst({
      where: { id: organizationId, status: 'ACTIVE', deletedAt: null },
    });
  }

  async findActiveMembership(organizationId: string, userId: string) {
    return this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        status: 'ACTIVE',
        removedAt: null,
      },
    });
  }

  async findMemberByTarget(
    organizationId: string,
    targetProvider: InvitationTargetProvider,
    targetProviderAccountId: string,
  ) {
    if (targetProvider !== 'telegram') {
      return null;
    }

    return this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        status: 'ACTIVE',
        removedAt: null,
        user: {
          deletedAt: null,
          accounts: {
            some: {
              provider: 'telegram',
              providerAccountId: targetProviderAccountId,
              deletedAt: null,
            },
          },
        },
      },
    });
  }

  async createOrRefreshPending(input: CreateOrRefreshPendingInput) {
    if (input.mode === 'claimable_link') {
      return this.prisma.organizationInvitation.create({
        data: {
          organizationId: input.organizationId,
          mode: input.mode,
          targetDisplay: input.targetDisplay ?? null,
          email: input.email ?? null,
          role: input.role,
          tokenHash: input.tokenHash,
          invitedByUserId: input.invitedByUserId,
          expiresAt: input.expiresAt,
        },
      });
    }

    if (!input.targetProvider || !input.targetProviderAccountId) {
      throw new Error('TARGETED_INVITATION_REQUIRES_TARGET');
    }
    const targetProvider = input.targetProvider;
    const targetProviderAccountId = input.targetProviderAccountId;

    const pending = await this.prisma.organizationInvitation.findFirst({
      where: {
        organizationId: input.organizationId,
        targetProvider,
        targetProviderAccountId,
        status: 'PENDING',
        acceptedAt: null,
        revokedAt: null,
      },
    });

    if (pending) {
      return this.prisma.organizationInvitation.update({
        where: { id: pending.id },
        data: {
          mode: input.mode,
          role: input.role,
          targetDisplay: input.targetDisplay ?? null,
          email: input.email ?? null,
          tokenHash: input.tokenHash,
          invitedByUserId: input.invitedByUserId,
          expiresAt: input.expiresAt,
        },
      });
    }

    return this.prisma.organizationInvitation.create({
      data: {
        organizationId: input.organizationId,
        mode: input.mode,
        targetProvider,
        targetProviderAccountId,
        targetDisplay: input.targetDisplay ?? null,
        email: input.email ?? null,
        role: input.role,
        tokenHash: input.tokenHash,
        invitedByUserId: input.invitedByUserId,
        expiresAt: input.expiresAt,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<InvitationWithOrganization | null> {
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { tokenHash },
      select: this.invitationWithOrganizationSelect(),
    });

    return invitation;
  }

  async findPendingById(invitationId: string): Promise<InvitationWithOrganization | null> {
    const invitation = await this.prisma.organizationInvitation.findFirst({
      where: {
        id: invitationId,
        status: 'PENDING',
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: this.invitationWithOrganizationSelect(),
    });

    return invitation;
  }

  async findUserForInvitation(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        deletedAt: true,
        accounts: {
          where: { provider: 'telegram', deletedAt: null },
          select: { provider: true, providerAccountId: true },
        },
      },
    });
  }

  async findPendingInvitationForTarget(
    targetProvider: InvitationTargetProvider,
    targetProviderAccountId: string,
  ) {
    return this.prisma.organizationInvitation.findFirst({
      where: {
        mode: 'targeted_telegram',
        targetProvider,
        targetProviderAccountId,
        status: 'PENDING',
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        organization: {
          status: 'ACTIVE',
          deletedAt: null,
        },
      },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async hasValidClaimableInvitationTokenHash(tokenHash: string): Promise<boolean> {
    const invitation = await this.prisma.organizationInvitation.findFirst({
      where: {
        tokenHash,
        mode: 'claimable_link',
        status: 'PENDING',
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        organization: {
          status: 'ACTIVE',
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    return invitation !== null;
  }

  async listPendingForUserTelegramAccounts(userId: string): Promise<InvitationWithOrganization[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        accounts: {
          where: { provider: 'telegram', deletedAt: null },
          select: { providerAccountId: true },
        },
      },
    });
    const providerAccountIds = user?.accounts.map((account) => account.providerAccountId) ?? [];
    if (providerAccountIds.length === 0) {
      return [];
    }

    const invitations = await this.prisma.organizationInvitation.findMany({
      where: {
        mode: 'targeted_telegram',
        targetProvider: 'telegram',
        targetProviderAccountId: { in: providerAccountIds },
        status: 'PENDING',
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: this.invitationWithOrganizationSelect(),
      orderBy: { createdAt: 'asc' },
    });

    return invitations;
  }

  async accept(input: {
    invitationId: string;
    userId: string;
    organizationId: string;
    role: OrganizationRole;
    acceptedProviderAccountId: string;
    claim?: {
      targetProvider: InvitationTargetProvider;
      targetProviderAccountId: string;
    };
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existingMember = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: input.userId,
          },
        },
      });

      if (existingMember && existingMember.status === 'ACTIVE') {
        throw new Error('User is already a member of this organization');
      }

      const memberData: Prisma.OrganizationMemberUncheckedCreateInput = {
        organizationId: input.organizationId,
        userId: input.userId,
        role: input.role,
        status: 'ACTIVE',
        source: 'INVITATION',
        claimedAt: new Date(),
      };

      if (existingMember) {
        await tx.organizationMember.update({
          where: { id: existingMember.id },
          data: {
            role: input.role,
            status: 'ACTIVE',
            removedAt: null,
            joinedAt: new Date(),
            source: 'INVITATION',
            claimedAt: new Date(),
          },
        });
      } else {
        const user = await tx.user.findUnique({
          where: { id: input.userId },
          select: { displayName: true, email: true },
        });
        const createdMember = await tx.organizationMember.create({ data: memberData });
        await tx.organizationMemberProfile.create({
          data: {
            membershipId: createdMember.id,
            displayName: user?.displayName ?? user?.email ?? 'Member',
            email: user?.email ?? null,
          },
        });
      }

      const invitationUpdate = await tx.organizationInvitation.updateMany({
        where: {
          id: input.invitationId,
          status: 'PENDING',
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          organization: { status: 'ACTIVE', deletedAt: null },
          ...(input.claim
            ? {
                OR: [
                  { targetProvider: null, targetProviderAccountId: null },
                  {
                    targetProvider: input.claim.targetProvider,
                    targetProviderAccountId: input.claim.targetProviderAccountId,
                  },
                ],
              }
            : {}),
        },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          ...(input.claim
            ? {
                targetProvider: input.claim.targetProvider,
                targetProviderAccountId: input.claim.targetProviderAccountId,
                claimedByUserId: input.userId,
                claimedAt: new Date(),
              }
            : {}),
        },
      });

      if (invitationUpdate.count !== 1) {
        throw new Error('INVITATION_NOT_PENDING');
      }

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.userId,
          action: 'ACCEPT',
          entityType: 'OrganizationInvitation',
          entityId: input.invitationId,
          metadata: {
            role: input.role,
            targetProvider: input.claim?.targetProvider ?? 'telegram',
            targetProviderAccountId: input.acceptedProviderAccountId,
          },
        },
      });

      return { organizationId: input.organizationId };
    });
  }

  async revoke(organizationId: string, invitationId: string) {
    const invitation = await this.prisma.organizationInvitation.findFirst({
      where: {
        id: invitationId,
        organizationId,
        status: 'PENDING',
        acceptedAt: null,
        revokedAt: null,
      },
    });
    if (!invitation) {
      return null;
    }

    return this.prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });
  }

  async resend(organizationId: string, invitationId: string, tokenHash: string, expiresAt: Date) {
    const invitation = await this.prisma.organizationInvitation.findFirst({
      where: {
        id: invitationId,
        organizationId,
        status: 'PENDING',
        acceptedAt: null,
        revokedAt: null,
      },
    });
    if (!invitation) {
      return null;
    }

    return this.prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { tokenHash, expiresAt },
      include: { organization: true },
    });
  }

  async findManageableById(organizationId: string, invitationId: string) {
    return this.prisma.organizationInvitation.findFirst({
      where: {
        id: invitationId,
        organizationId,
        status: 'PENDING',
        acceptedAt: null,
        revokedAt: null,
      },
      include: { organization: true },
    });
  }

  async listPendingForOrganization(organizationId: string) {
    return this.prisma.organizationInvitation.findMany({
      where: {
        organizationId,
        status: 'PENDING',
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private invitationWithOrganizationSelect() {
    return {
      id: true,
      organizationId: true,
      email: true,
      mode: true,
      targetProvider: true,
      targetProviderAccountId: true,
      targetDisplay: true,
      role: true,
      status: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    } satisfies Prisma.OrganizationInvitationSelect;
  }
}
