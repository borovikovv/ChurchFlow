import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { AUTH_COOKIE_NAMES } from '@churchflow/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { sessionCookieOptions } from '../auth/session-cookie';
import { sessionIdleExpiresAt, shouldTouchSession } from '../auth/session-policy';

export interface AuthContext {
  userId: string;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.getSessionToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing session token');
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: createHash('sha256').update(token).digest('hex') },
      select: {
        id: true,
        userId: true,
        type: true,
        expiresAt: true,
        absoluteExpiresAt: true,
        lastUsedAt: true,
        revokedAt: true,
        user: { select: { deletedAt: true } },
      },
    });

    const now = new Date();
    if (
      !session ||
      session.type !== 'user' ||
      session.revokedAt !== null ||
      session.user.deletedAt !== null ||
      session.expiresAt.getTime() <= now.getTime() ||
      session.absoluteExpiresAt.getTime() <= now.getTime()
    ) {
      throw new UnauthorizedException('Session is no longer active');
    }

    if (shouldTouchSession(session.lastUsedAt, now)) {
      const expiresAt = sessionIdleExpiresAt(now, session.absoluteExpiresAt);
      await this.prisma.session.update({
        where: { id: session.id },
        data: { expiresAt, lastUsedAt: now },
        select: { id: true },
      });
      this.refreshSessionCookie(context, token, expiresAt);
    }

    request.auth = { userId: session.userId, sessionId: session.id };
    return true;
  }

  // The cookie tracks the idle window rather than the absolute ceiling, so a browser
  // that stops visiting drops the cookie exactly when the session stops being usable.
  private refreshSessionCookie(context: ExecutionContext, token: string, expiresAt: Date): void {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.headers.cookie?.includes(`${AUTH_COOKIE_NAMES.session}=`)) {
      return;
    }

    context
      .switchToHttp()
      .getResponse<Response>()
      .cookie(AUTH_COOKIE_NAMES.session, token, {
        ...sessionCookieOptions(this.config),
        expires: expiresAt,
      });
  }

  private getSessionToken(request: Request): string | undefined {
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (bearer) {
      return bearer;
    }

    return this.parseCookies(request.headers.cookie)[AUTH_COOKIE_NAMES.session];
  }

  private parseCookies(cookieHeader?: string): Record<string, string> {
    if (!cookieHeader) {
      return {};
    }

    return cookieHeader.split(';').reduce<Record<string, string>>((cookies, cookie) => {
      const [name, ...value] = cookie.trim().split('=');
      if (name) {
        cookies[name] = decodeURIComponent(value.join('='));
      }
      return cookies;
    }, {});
  }
}
