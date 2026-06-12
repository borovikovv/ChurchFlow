import { Injectable } from '@nestjs/common';
import type { Prisma } from '@churchflow/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createEmailLoginToken(input: {
    email: string;
    tokenHash: string;
    redirectTo?: string;
    expiresAt: Date;
  }) {
    return this.prisma.emailLoginToken.create({
      data: {
        email: input.email,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        ...(input.redirectTo ? { redirectTo: input.redirectTo } : {}),
      },
    });
  }

  async findEmailLoginToken(tokenHash: string) {
    return this.prisma.emailLoginToken.findUnique({ where: { tokenHash } });
  }

  async consumeEmailLoginToken(input: { id: string; userId: string }) {
    return this.prisma.emailLoginToken.update({
      where: { id: input.id },
      data: { usedAt: new Date(), userId: input.userId },
    });
  }

  async findOrCreateEmailUser(input: { email: string; displayName?: string }) {
    return this.prisma.user.upsert({
      where: { email: input.email },
      update: {
        emailVerified: new Date(),
        ...(input.displayName ? { displayName: input.displayName } : {}),
      },
      create: {
        email: input.email,
        emailVerified: new Date(),
        ...(input.displayName ? { displayName: input.displayName } : {}),
      },
    });
  }

  async upsertEmailAuthAccount(userId: string, email: string) {
    return this.prisma.authAccount.upsert({
      where: { provider_providerAccountId: { provider: 'email', providerAccountId: email } },
      update: { userId, lastUsedAt: new Date(), deletedAt: null },
      create: {
        userId,
        provider: 'email',
        providerAccountId: email,
        lastUsedAt: new Date(),
      },
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
