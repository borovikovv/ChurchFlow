import { Injectable } from '@nestjs/common';
import type { Prisma } from '@churchflow/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateTelegramUser(input: {
    providerAccountId: string;
    displayName?: string;
    username?: string;
    avatarUrl?: string;
  }) {
    const existingAccount = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'telegram',
          providerAccountId: input.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (existingAccount) {
      await this.prisma.authAccount.update({
        where: { id: existingAccount.id },
        data: {
          lastUsedAt: new Date(),
          deletedAt: null,
          metadata: {
            username: input.username ?? null,
          },
        },
      });

      return existingAccount.user;
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          ...(input.displayName ? { displayName: input.displayName } : {}),
          ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
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
  }

  async createSession(input: Prisma.SessionUncheckedCreateInput) {
    return this.prisma.session.create({ data: input });
  }

  async findSession(sessionId: string) {
    return this.prisma.session.findUnique({ where: { id: sessionId } });
  }

  async findSessionByRefreshTokenHash(refreshTokenHash: string) {
    return this.prisma.session.findFirst({
      where: { refreshTokenHash },
      include: { user: true },
    });
  }

  async revokeSession(sessionId: string) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }
}
