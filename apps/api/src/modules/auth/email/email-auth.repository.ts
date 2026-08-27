import { Injectable } from '@nestjs/common';
import { Prisma, type EmailLoginTokenPurpose } from '@churchflow/db';
import type { AppLocale } from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  EMAIL_LOGIN_MAX_CODE_ATTEMPTS,
  EMAIL_LOGIN_REQUESTS_PER_WINDOW,
  EMAIL_LOGIN_TOKEN_RETENTION_SECONDS,
} from './email-login-policy';
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

  // Left in the same shape a verification link leaves it: the address is confirmed and the
  // account carries exactly one email sign-in method for it.
  async confirmEmailIdentity(userId: string, email: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      // An address counts as confirmed only while the account still holds it, so a profile
      // that moved on between the mail and the click leaves nothing to confirm.
      const confirmed = await tx.user.updateMany({
        where: { id: userId, email, deletedAt: null },
        data: { emailVerified: now },
      });

      if (confirmed.count === 0) {
        return;
      }

      // User emails are unique and the profile drops the auth account when the address
      // changes, so anything still sitting on this address is a leftover.
      await tx.authAccount.deleteMany({
        where: { provider: 'email', providerAccountId: email },
      });

      await tx.authAccount.create({
        data: { userId, provider: 'email', providerAccountId: email, lastUsedAt: now },
      });
    });
  }

  async touchEmailAccount(userId: string): Promise<void> {
    await this.prisma.authAccount.updateMany({
      where: { userId, provider: 'email', deletedAt: null },
      data: { lastUsedAt: new Date() },
    });
  }

  countRecentTokens(email: string, purpose: EmailLoginTokenPurpose, since: Date): Promise<number> {
    return this.prisma.emailLoginToken.count({
      where: { email, purpose, createdAt: { gt: since } },
    });
  }

  async issueToken(input: IssueEmailLoginTokenInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Asking for a new link deliberately leaves the older ones alone. Anybody who knows an
      // address can ask, so retiring them here would hand a stranger the power to invalidate
      // the link somebody is holding. They expire on the same short clock either way, and how
      // many can exist at once is already bounded by the per-address request cap.

      // Swept here rather than by a scheduled job: the table only grows when somebody asks
      // for a token, so that is also the cheapest moment to drop the ones nobody can use.
      await tx.emailLoginToken.deleteMany({
        where: {
          expiresAt: { lt: new Date(Date.now() - EMAIL_LOGIN_TOKEN_RETENTION_SECONDS * 1000) },
        },
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

  // Every live token for the address, newest first, because more than one can now be live at
  // once and the code somebody is holding may belong to any of them. Bounded by the same cap
  // that limits how many can be issued, so one wrong guess costs a fixed amount of key
  // derivation however the table happens to look.
  async findLiveSignInTokens(email: string): Promise<LiveEmailSignInToken[]> {
    return this.prisma.emailLoginToken.findMany({
      where: { email, purpose: 'sign_in', consumedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, codeHash: true, redirectTo: true },
      orderBy: { createdAt: 'desc' },
      take: EMAIL_LOGIN_REQUESTS_PER_WINDOW,
    });
  }

  // One wrong guess spends an attempt on every token the address has live, so asking for more
  // links can never buy more guesses.
  //
  // Counting the attempt and deciding whether it was the last one have to be one statement.
  // Reading the count first and burning the token second lets concurrent guesses each see the
  // same stale count and walk straight past the cap.
  // These columns are `timestamp` without a zone and Prisma writes UTC into them, so the clock
  // has to be read as UTC too. Bare `now()` would be read in the server's own zone, which is
  // only the same thing while that zone happens to be UTC.
  async recordFailedCodeAttempts(email: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "email_login_tokens"
      SET "attempt_count" = "attempt_count" + 1,
          "consumed_at" = CASE
            WHEN "attempt_count" + 1 >= ${EMAIL_LOGIN_MAX_CODE_ATTEMPTS}
              THEN (now() AT TIME ZONE 'UTC')
            ELSE "consumed_at"
          END
      WHERE "email" = ${email}::citext
        AND "purpose" = 'sign_in'::"EmailLoginTokenPurpose"
        AND "consumed_at" IS NULL
        AND "expires_at" > (now() AT TIME ZONE 'UTC')
    `;
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
