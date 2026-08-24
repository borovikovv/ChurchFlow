import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../context/request-context.service';
import { hashOpaqueToken, sessionTokenFromRequest } from '../auth/session-token';
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
    private readonly context: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = sessionTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException('Missing session token');
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
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
      await this.prisma.session.update({
        where: { id: session.id },
        data: { expiresAt: sessionIdleExpiresAt(now, session.absoluteExpiresAt), lastUsedAt: now },
        select: { id: true },
      });
    }

    request.auth = { userId: session.userId, sessionId: session.id };
    this.context.setUserId(session.userId);
    return true;
  }
}
