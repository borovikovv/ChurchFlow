import { Injectable } from '@nestjs/common';
import { Prisma, type PlatformRole, type SessionRevokeReason } from '@churchflow/db';
import type { AppLocale } from '@churchflow/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuthRepositoryUser {
  id: string;
  email: string | null;
  displayName: string | null;
  platformRole: PlatformRole;
}

export interface AuthRepositoryUserWithDeletedAt extends AuthRepositoryUser {
  deletedAt: Date | null;
}

export interface TelegramLoginAccountState {
  accountId: string;
  user: AuthRepositoryUser;
  isActive: boolean;
  hasActiveMembership: boolean;
  hasOrganizationRequest: boolean;
  hasPendingOrganizationRequest: boolean;
  hasMembershipClaim: boolean;
  isPlatformAdmin: boolean;
}

export interface CreatedSession {
  id: string;
}

export interface UserSessionRecord {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTelegramLoginAccountState(
    providerAccountId: string,
  ): Promise<TelegramLoginAccountState | null> {
    const account = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'telegram',
          providerAccountId,
        },
      },
      select: {
        id: true,
        deletedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            platformRole: true,
            deletedAt: true,
            memberships: {
              where: {
                status: 'ACTIVE',
                removedAt: null,
                organization: { status: 'ACTIVE', deletedAt: null },
              },
              select: { id: true },
            },
            requestedOrganizationRequests: {
              select: { status: true },
            },
            requestedMembershipClaims: {
              where: { status: { in: ['REQUESTED', 'APPROVED', 'REJECTED'] } },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!account) {
      return null;
    }

    return {
      accountId: account.id,
      user: {
        id: account.user.id,
        email: account.user.email,
        displayName: account.user.displayName,
        platformRole: account.user.platformRole,
      },
      isActive: account.deletedAt === null && account.user.deletedAt === null,
      hasActiveMembership: account.user.memberships.length > 0,
      hasOrganizationRequest: account.user.requestedOrganizationRequests.length > 0,
      hasPendingOrganizationRequest: account.user.requestedOrganizationRequests.some(
        (request) => request.status === 'PENDING',
      ),
      hasMembershipClaim: account.user.requestedMembershipClaims.length > 0,
      isPlatformAdmin:
        account.user.platformRole === 'ADMIN' || account.user.platformRole === 'SUPER_ADMIN',
    };
  }

  async hasPendingTelegramInvitation(providerAccountId: string): Promise<boolean> {
    const invitation = await this.prisma.organizationInvitation.findFirst({
      where: {
        targetProvider: 'telegram',
        targetProviderAccountId: providerAccountId,
        status: 'PENDING',
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true },
    });

    return invitation !== null;
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
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true },
    });

    return invitation !== null;
  }

  async hasValidPlatformAdminBootstrapTokenHash(tokenHash: string): Promise<boolean> {
    const [bootstrap, existingAdmin] = await Promise.all([
      this.prisma.platformAdminBootstrapToken.findFirst({
        where: {
          tokenHash,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: { platformRole: 'SUPER_ADMIN', deletedAt: null },
        select: { id: true },
      }),
    ]);

    return bootstrap !== null && existingAdmin === null;
  }

  async hasValidMembershipClaimTokenHash(tokenHash: string): Promise<boolean> {
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

  async touchTelegramAccount(accountId: string, username?: string): Promise<AuthRepositoryUser> {
    const account = await this.prisma.authAccount.update({
      where: { id: accountId },
      data: {
        lastUsedAt: new Date(),
        metadata: {
          username: username ?? null,
        },
      },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            platformRole: true,
          },
        },
      },
    });

    return account.user;
  }

  async createTelegramUserForAdmission(input: {
    providerAccountId: string;
    displayName?: string;
    username?: string;
    avatarUrl?: string;
    locale?: AppLocale;
  }): Promise<AuthRepositoryUser> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            ...(input.displayName ? { displayName: input.displayName } : {}),
            ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
            ...(input.locale ? { locale: input.locale } : {}),
          },
          select: {
            id: true,
            email: true,
            displayName: true,
            platformRole: true,
          },
        });

        await tx.authAccount.create({
          data: {
            userId: user.id,
            provider: 'telegram',
            providerAccountId: input.providerAccountId,
            lastUsedAt: new Date(),
            metadata: {
              username: input.username ?? null,
            },
          },
        });

        return user;
      });
    } catch (error: unknown) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }

      const existing = await this.findTelegramLoginAccountState(input.providerAccountId);
      if (!existing || !existing.isActive) {
        throw new Error('TELEGRAM_ACCOUNT_INACTIVE');
      }

      return existing.user;
    }
  }

  async createSession(input: Prisma.SessionUncheckedCreateInput): Promise<CreatedSession> {
    const session = await this.prisma.session.create({
      data: input,
      select: { id: true },
    });

    return { id: session.id };
  }

  async revokeSessionByTokenHash(tokenHash: string, reason: SessionRevokeReason): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });

    return result.count;
  }

  async listUserSessions(userId: string): Promise<UserSessionRecord[]> {
    return this.prisma.session.findMany({
      where: { userId, type: 'user', revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        deviceName: true,
        ipAddress: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async revokeUserSession(
    sessionId: string,
    userId: string,
    reason: SessionRevokeReason,
  ): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, type: 'user', revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });

    return result.count;
  }

  async revokeOtherUserSessions(
    userId: string,
    keptSessionId: string,
    reason: SessionRevokeReason,
  ): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, type: 'user', revokedAt: null, id: { not: keptSessionId } },
      data: { revokedAt: new Date(), revokedReason: reason },
    });

    return result.count;
  }

  async countPurgeableSessions(cutoff: Date): Promise<number> {
    return this.prisma.session.count({
      where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
    });
  }

  async purgeSessions(input: { cutoff: Date; batchSize: number; maxBatches: number }) {
    let deletedCount = 0;
    let batches = 0;

    while (batches < input.maxBatches) {
      const deleted = await this.prisma.$executeRaw`
        DELETE FROM "sessions"
        WHERE "id" IN (
          SELECT "id"
          FROM "sessions"
          WHERE "expires_at" < ${input.cutoff.toISOString()}::timestamp
             OR "revoked_at" < ${input.cutoff.toISOString()}::timestamp
          LIMIT ${input.batchSize}
        )
      `;
      batches += 1;
      deletedCount += deleted;

      if (deleted < input.batchSize) {
        return { deletedCount, batches, exhausted: false };
      }
    }

    return { deletedCount, batches, exhausted: true };
  }
}
