import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify } from 'node:crypto';
import type { Request } from 'express';
import { AUTH_COOKIE_NAMES, jwtPayloadSchema, type JwtPayload } from '@churchflow/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuthenticatedRequest extends Request {
  auth?: JwtPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.getAccessToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const payload = this.verifyAccessToken(token);
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.user.deletedAt !== null ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Session is no longer active');
    }

    request.auth = payload;
    return true;
  }

  private getAccessToken(request: Request): string | undefined {
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (bearer) {
      return bearer;
    }

    return this.parseCookies(request.headers.cookie)[AUTH_COOKIE_NAMES.access];
  }

  private parseCookies(cookieHeader?: string): Record<string, string> {
    if (!cookieHeader) {
      return {};
    }

    return Object.fromEntries(
      cookieHeader
        .split(';')
        .map((cookie) => {
          const [name, ...value] = cookie.trim().split('=');
          return [name, decodeURIComponent(value.join('='))];
        })
        .filter(([name]) => Boolean(name)),
    );
  }

  private verifyAccessToken(token: string): JwtPayload {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) {
      throw new UnauthorizedException('Invalid access token');
    }

    const isValid = verify(
      'RSA-SHA256',
      Buffer.from(`${header}.${body}`),
      this.publicKey,
      Buffer.from(signature, 'base64url'),
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid access token');
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as unknown;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    const payload = jwtPayloadSchema.safeParse(decoded);
    const exp =
      typeof decoded === 'object' && decoded !== null && 'exp' in decoded ? decoded.exp : undefined;

    if (!payload.success || payload.data.type !== 'access' || typeof exp !== 'number') {
      throw new UnauthorizedException('Invalid access token');
    }

    if (exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Expired access token');
    }

    return payload.data;
  }

  private normalizePem(value: string): string {
    return value.replace(/\\n/g, '\n');
  }

  private get publicKey(): string {
    return this.normalizePem(this.config.getOrThrow<string>('JWT_ACCESS_PUBLIC_KEY'));
  }
}
