import { Injectable } from '@nestjs/common';
import { Prisma, type EmailLoginTokenPurpose } from '@churchflow/db';
import type { AppLocale } from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  LOGIN_STATE_SELECT,
  toLoginUserState,
  type LoginUser,
  type LoginUserState,
} from '../login-state';

export interface EmailVerificationCandidate {
  id: string;
  email: string;
  emailVerified: Date | null;
}

export interface IssueEmailLoginTokenInput {
  email: string;
  purpose: EmailLoginTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  codeHash?: string;
  userId?: string;
  redirectTo?: string;
  requestIp?: string;
  userAgent?: string;
}

export interface ConsumedEmailVerification {
  userId: string;
  email: string;
}

export interface ConsumedEmailSignIn {
  email: string;
  redirectTo: string | null;
}

export interface LiveEmailSignInToken {
  id: string;
  codeHash: string | null;
  attemptCount: number;
  redirectTo: string | null;
}

@Injectable()
export class EmailAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findVerificationCandidate(userId: string): Promise<EmailVerificationCandidate | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!user?.email) {
      return null;
    }

    return { id: user.id, email: user.email, emailVerified: user.emailVerified };
  }

  async findLoginAccountState(email: string): Promise<LoginUserState | null> {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: LOGIN_STATE_SELECT,
    });

    return user ? toLoginUserState(user) : null;
  }

  async createAdmittedEmailUser(input: { email: string; locale?: AppLocale }): Promise<LoginUser> {
    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: input.email,
            emailVerified: now,
            ...(input.locale ? { locale: input.locale } : {}),
          },
          select: { id: true, email: true, displayName: true, platformRole: true },
        });

        await tx.authAccount.create({
          data: {
            userId: user.id,
            provider: 'email',
            providerAccountId: input.email,
            lastUsedAt: now,
          },
        });

        return user;
      });
    } catch (error: unknown) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }

      const existing = await this.findLoginAccountState(input.email);
      if (!existing) {
        throw error;
      }

      return existing.user;
    }
  }

  async touchEmailAccount(userId: string): Promise<void> {
    await this.prisma.authAccount.updateMany({
      where: { userId, provider: 'email', deletedAt: null },
      data: { lastUsedAt: new Date() },
    });
  }

  async issueToken(input: IssueEmailLoginTokenInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // One live token per address and purpose: asking for a new link retires the old one
      // instead of leaving several usable at once.
      await tx.emailLoginToken.updateMany({
        where: { email: input.email, purpose: input.purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      await tx.emailLoginToken.create({
        data: {
          email: input.email,
          purpose: input.purpose,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          ...(input.codeHash ? { codeHash: input.codeHash } : {}),
          ...(input.userId ? { userId: input.userId } : {}),
          ...(input.redirectTo ? { redirectTo: input.redirectTo } : {}),
          ...(input.requestIp ? { requestIp: input.requestIp } : {}),
          ...(input.userAgent ? { userAgent: input.userAgent } : {}),
        },
      });
    });
  }

  async consumeSignInTokenByHash(tokenHash: string): Promise<ConsumedEmailSignIn | null> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      // Consuming first is what makes the link single-use: a second request finds nothing
      // left to update and stops here.
      const consumed = await tx.emailLoginToken.updateMany({
        where: { tokenHash, purpose: 'sign_in', consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });

      if (consumed.count === 0) {
        return null;
      }

      const token = await tx.emailLoginToken.findUnique({
        where: { tokenHash },
        select: { email: true, redirectTo: true },
      });

      return token ? { email: token.email, redirectTo: token.redirectTo } : null;
    });
  }

  async findLiveSignInToken(email: string): Promise<LiveEmailSignInToken | null> {
    return this.prisma.emailLoginToken.findFirst({
      where: { email, purpose: 'sign_in', consumedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, codeHash: true, attemptCount: true, redirectTo: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async recordFailedCodeAttempt(tokenId: string, burn: boolean): Promise<void> {
    await this.prisma.emailLoginToken.updateMany({
      where: { id: tokenId, consumedAt: null },
      data: { attemptCount: { increment: 1 }, ...(burn ? { consumedAt: new Date() } : {}) },
    });
  }

  async consumeSignInTokenById(tokenId: string): Promise<boolean> {
    const consumed = await this.prisma.emailLoginToken.updateMany({
      where: { id: tokenId, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });

    return consumed.count > 0;
  }

  async consumeVerificationToken(tokenHash: string): Promise<ConsumedEmailVerification | null> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const consumed = await tx.emailLoginToken.updateMany({
        where: {
          tokenHash,
          purpose: 'verify_email',
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });

      if (consumed.count === 0) {
        return null;
      }

      const token = await tx.emailLoginToken.findUnique({
        where: { tokenHash },
        select: { email: true, userId: true },
      });

      if (!token?.userId) {
        return null;
      }

      // An address counts as verified only while the account still holds it, so changing it
      // in the profile leaves an older link with nothing to confirm.
      const user = await tx.user.findFirst({
        where: { id: token.userId, email: token.email, deletedAt: null },
        select: { id: true },
      });

      if (!user) {
        return null;
      }

      await tx.user.update({ where: { id: user.id }, data: { emailVerified: now } });

      // User emails are unique and the profile drops the auth account when the address
      // changes, so anything still sitting on this address is a leftover.
      await tx.authAccount.deleteMany({
        where: { provider: 'email', providerAccountId: token.email },
      });

      await tx.authAccount.create({
        data: {
          userId: user.id,
          provider: 'email',
          providerAccountId: token.email,
          lastUsedAt: now,
        },
      });

      return { userId: user.id, email: token.email };
    });
  }
}
