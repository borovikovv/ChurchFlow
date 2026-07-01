import { Injectable } from '@nestjs/common';
import type { MembershipClaimStatus } from '@churchflow/db';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MembershipClaimsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTokenHash(tokenHash: string) {
    return this.prisma.membershipClaim.findUnique({
      where: { tokenHash },
      include: {
        membership: {
          include: {
            organization: { select: { id: true, name: true, status: true, deletedAt: true } },
            profile: true,
          },
        },
      },
    });
  }

  async hasValidPendingTokenHash(tokenHash: string): Promise<boolean> {
    const claim = await this.prisma.membershipClaim.findFirst({
      where: {
        tokenHash,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
        membership: {
          userId: null,
          status: 'ACTIVE',
          removedAt: null,
          role: { in: ['MEMBER', 'VIEWER'] },
          organization: { status: 'ACTIVE', deletedAt: null },
        },
      },
      select: { id: true },
    });
    return claim !== null;
  }

  async hasClaimForUser(userId: string): Promise<boolean> {
    const claim = await this.prisma.membershipClaim.findFirst({
      where: { requestedByUserId: userId, status: { in: ['REQUESTED', 'APPROVED', 'REJECTED'] } },
      select: { id: true },
    });
    return claim !== null;
  }

  listForUser(userId: string) {
    return this.prisma.membershipClaim.findMany({
      where: { requestedByUserId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        requestedAt: true,
        approvedAt: true,
        rejectedAt: true,
        membership: {
          select: {
            organizationId: true,
            organization: { select: { name: true } },
          },
        },
      },
    });
  }

  findManageableById(organizationId: string, claimId: string) {
    return this.prisma.membershipClaim.findFirst({
      where: { id: claimId, membership: { organizationId } },
      include: { membership: { include: { profile: true } } },
    });
  }

  async createOrRefresh(input: {
    organizationId: string;
    membershipId: string;
    actorUserId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const actor = await tx.organizationMember.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: input.actorUserId,
          role: { in: ['OWNER', 'ADMIN'] },
          status: 'ACTIVE',
          removedAt: null,
          organization: { status: 'ACTIVE', deletedAt: null },
        },
      });
      if (!actor) throw new Error('ACTOR_CANNOT_MANAGE_CLAIMS');

      const membership = await tx.organizationMember.findFirst({
        where: {
          id: input.membershipId,
          organizationId: input.organizationId,
          userId: null,
          status: 'ACTIVE',
          removedAt: null,
          role: { in: ['MEMBER', 'VIEWER'] },
          organization: { status: 'ACTIVE', deletedAt: null },
        },
        include: { profile: true, organization: { select: { name: true } } },
      });
      if (!membership) throw new Error('MEMBERSHIP_NOT_CLAIMABLE');

      const existing = await tx.membershipClaim.findFirst({
        where: { membershipId: membership.id, status: { in: ['PENDING', 'REQUESTED'] } },
      });
      if (existing?.status === 'REQUESTED') throw new Error('CLAIM_ALREADY_REQUESTED');

      const claim = existing
        ? await tx.membershipClaim.update({
            where: { id: existing.id },
            data: { tokenHash: input.tokenHash, expiresAt: input.expiresAt },
          })
        : await tx.membershipClaim.create({
            data: {
              membershipId: membership.id,
              tokenHash: input.tokenHash,
              expiresAt: input.expiresAt,
              createdByUserId: input.actorUserId,
            },
          });

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: existing ? 'REFRESH_MEMBERSHIP_CLAIM' : 'CREATE_MEMBERSHIP_CLAIM',
          entityType: 'MembershipClaim',
          entityId: claim.id,
          metadata: { membershipId: membership.id },
        },
      });

      return {
        claim,
        organizationId: input.organizationId,
        organizationName: membership.organization.name,
        profile: membership.profile,
      };
    });
  }

  async request(tokenHash: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.membershipClaim.findUnique({
        where: { tokenHash },
        include: { membership: { include: { organization: true } } },
      });
      if (!claim) throw new Error('CLAIM_NOT_FOUND');
      if (claim.status !== 'PENDING') throw new Error('CLAIM_NOT_PENDING');
      if (claim.expiresAt.getTime() <= Date.now()) {
        await tx.membershipClaim.update({
          where: { id: claim.id },
          data: { status: 'EXPIRED' },
        });
        return { expired: true as const };
      }
      if (
        claim.membership.userId !== null ||
        claim.membership.status !== 'ACTIVE' ||
        claim.membership.removedAt !== null ||
        claim.membership.organization.status !== 'ACTIVE' ||
        claim.membership.organization.deletedAt !== null
      ) {
        throw new Error('MEMBERSHIP_NOT_CLAIMABLE');
      }

      const user = await tx.user.findFirst({
        where: { id: actorUserId, deletedAt: null },
        include: {
          accounts: {
            where: { provider: 'telegram', deletedAt: null },
            select: { providerAccountId: true },
            take: 1,
          },
        },
      });
      const telegramAccount = user?.accounts[0];
      if (!user || !telegramAccount) throw new Error('TELEGRAM_ACCOUNT_REQUIRED');

      const requested = await tx.membershipClaim.updateMany({
        where: { id: claim.id, status: 'PENDING', requestedByUserId: null },
        data: {
          status: 'REQUESTED',
          requestedAt: new Date(),
          requestedByUserId: actorUserId,
          provider: 'telegram',
          providerAccountId: telegramAccount.providerAccountId,
        },
      });
      if (requested.count !== 1) throw new Error('CLAIM_NOT_PENDING');

      await tx.auditLog.create({
        data: {
          organizationId: claim.membership.organizationId,
          actorUserId,
          action: 'REQUEST_MEMBERSHIP_CLAIM',
          entityType: 'MembershipClaim',
          entityId: claim.id,
          metadata: { membershipId: claim.membershipId },
        },
      });

      return { expired: false as const, id: claim.id, status: 'REQUESTED' as const };
    });
  }

  async approve(organizationId: string, claimId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM membership_claims WHERE id = ${claimId}::uuid FOR UPDATE
      `;

      const actor = await tx.organizationMember.findFirst({
        where: {
          organizationId,
          userId: actorUserId,
          role: { in: ['OWNER', 'ADMIN'] },
          status: 'ACTIVE',
          removedAt: null,
          organization: { status: 'ACTIVE', deletedAt: null },
        },
      });
      if (!actor) throw new Error('ACTOR_CANNOT_MANAGE_CLAIMS');

      const claim = await tx.membershipClaim.findFirst({
        where: { id: claimId, status: 'REQUESTED', membership: { organizationId } },
        include: { membership: { include: { organization: true } } },
      });
      if (!claim || !claim.requestedByUserId || !claim.providerAccountId) {
        throw new Error('CLAIM_NOT_REQUESTED');
      }
      if (claim.expiresAt.getTime() <= Date.now()) {
        await tx.membershipClaim.update({
          where: { id: claim.id },
          data: { status: 'EXPIRED' },
        });
        return { conflict: false as const, expired: true as const, organizationId };
      }
      if (
        claim.membership.userId !== null ||
        claim.membership.status !== 'ACTIVE' ||
        claim.membership.removedAt !== null ||
        claim.membership.organization.status !== 'ACTIVE' ||
        claim.membership.organization.deletedAt !== null ||
        !['MEMBER', 'VIEWER'].includes(claim.membership.role)
      ) {
        throw new Error('MEMBERSHIP_NOT_CLAIMABLE');
      }

      const claimant = await tx.user.findFirst({
        where: {
          id: claim.requestedByUserId,
          deletedAt: null,
          accounts: {
            some: {
              provider: 'telegram',
              providerAccountId: claim.providerAccountId,
              deletedAt: null,
            },
          },
        },
        select: { id: true },
      });
      if (!claimant) throw new Error('CLAIMANT_INACTIVE');

      const existing = await tx.organizationMember.findFirst({
        where: { organizationId, userId: claimant.id, id: { not: claim.membershipId } },
        select: { id: true },
      });
      if (existing) {
        await tx.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'MEMBERSHIP_CLAIM_CONFLICT',
            entityType: 'MembershipClaim',
            entityId: claim.id,
            metadata: { membershipId: claim.membershipId },
          },
        });
        return { conflict: true as const, expired: false as const };
      }

      await tx.organizationMember.update({
        where: { id: claim.membershipId },
        data: { userId: claimant.id, claimedAt: new Date() },
      });
      await tx.membershipClaim.update({
        where: { id: claim.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          reviewedByUserId: actorUserId,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'APPROVE_MEMBERSHIP_CLAIM',
          entityType: 'MembershipClaim',
          entityId: claim.id,
          metadata: { membershipId: claim.membershipId },
        },
      });

      return { conflict: false as const, expired: false as const, organizationId };
    });
  }

  async changeStatus(input: {
    organizationId: string;
    claimId: string;
    actorUserId: string;
    action: 'REJECTED' | 'REVOKED';
  }) {
    return this.prisma.$transaction(async (tx) => {
      const actor = await tx.organizationMember.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: input.actorUserId,
          role: { in: ['OWNER', 'ADMIN'] },
          status: 'ACTIVE',
          removedAt: null,
          organization: { status: 'ACTIVE', deletedAt: null },
        },
      });
      if (!actor) throw new Error('ACTOR_CANNOT_MANAGE_CLAIMS');

      const allowedStatuses: MembershipClaimStatus[] =
        input.action === 'REJECTED' ? ['REQUESTED'] : ['PENDING', 'REQUESTED'];
      const changed = await tx.membershipClaim.updateMany({
        where: {
          id: input.claimId,
          status: { in: allowedStatuses },
          membership: { organizationId: input.organizationId },
        },
        data: {
          status: input.action,
          reviewedByUserId: input.actorUserId,
          ...(input.action === 'REJECTED' ? { rejectedAt: new Date() } : { revokedAt: new Date() }),
        },
      });
      if (changed.count !== 1) return null;

      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action:
            input.action === 'REJECTED' ? 'REJECT_MEMBERSHIP_CLAIM' : 'REVOKE_MEMBERSHIP_CLAIM',
          entityType: 'MembershipClaim',
          entityId: input.claimId,
          metadata: {},
        },
      });
      return { id: input.claimId, status: input.action };
    });
  }
}
