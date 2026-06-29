import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PlatformAdminBootstrapState {
  valid: boolean;
  reason: 'AVAILABLE' | 'NOT_FOUND' | 'EXPIRED' | 'CONSUMED' | 'ADMIN_EXISTS';
  expiresAt: Date | null;
}

@Injectable()
export class PlatformAdminBootstrapRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getState(tokenHash: string): Promise<PlatformAdminBootstrapState> {
    const [bootstrap, existingAdmin] = await Promise.all([
      this.prisma.platformAdminBootstrapToken.findUnique({
        where: { tokenHash },
        select: { expiresAt: true, consumedAt: true },
      }),
      this.prisma.user.findFirst({
        where: { platformRole: 'SUPER_ADMIN', deletedAt: null },
        select: { id: true },
      }),
    ]);

    if (existingAdmin) {
      return { valid: false, reason: 'ADMIN_EXISTS', expiresAt: bootstrap?.expiresAt ?? null };
    }
    if (!bootstrap) {
      return { valid: false, reason: 'NOT_FOUND', expiresAt: null };
    }
    if (bootstrap.consumedAt) {
      return { valid: false, reason: 'CONSUMED', expiresAt: bootstrap.expiresAt };
    }
    if (bootstrap.expiresAt.getTime() <= Date.now()) {
      return { valid: false, reason: 'EXPIRED', expiresAt: bootstrap.expiresAt };
    }

    return { valid: true, reason: 'AVAILABLE', expiresAt: bootstrap.expiresAt };
  }

  async consume(tokenHash: string, userId: string): Promise<{ userId: string }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ lock: string }>>`
        SELECT pg_advisory_xact_lock(
          hashtext('churchflow:platform-admin-bootstrap')
        )::text AS lock
      `;

      const existingAdmin = await tx.user.findFirst({
        where: { platformRole: 'SUPER_ADMIN', deletedAt: null },
        select: { id: true },
      });
      if (existingAdmin) {
        throw new Error('PLATFORM_ADMIN_ALREADY_EXISTS');
      }

      const user = await tx.user.findFirst({
        where: {
          id: userId,
          deletedAt: null,
          accounts: { some: { provider: 'telegram', deletedAt: null } },
        },
        select: { id: true, platformRole: true },
      });
      if (!user) {
        throw new Error('BOOTSTRAP_USER_NOT_ELIGIBLE');
      }

      const now = new Date();
      const claimed = await tx.platformAdminBootstrapToken.updateMany({
        where: {
          tokenHash,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          consumedAt: now,
          consumedByUserId: userId,
        },
      });
      if (claimed.count !== 1) {
        throw new Error('BOOTSTRAP_TOKEN_UNAVAILABLE');
      }

      await tx.user.update({
        where: { id: userId },
        data: { platformRole: 'SUPER_ADMIN' },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'PROMOTE_PLATFORM_ADMIN',
          entityType: 'User',
          entityId: userId,
          metadata: {
            previousRole: user.platformRole,
            role: 'SUPER_ADMIN',
            source: 'telegram_bootstrap',
          },
        },
      });

      return { userId };
    });
  }
}
