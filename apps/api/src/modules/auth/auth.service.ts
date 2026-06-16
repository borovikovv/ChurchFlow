import { BadRequestException, GoneException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, sign, verify } from 'node:crypto';
import { z } from 'zod';
import { jwtPayloadSchema } from '@churchflow/shared';
import { EmailService } from '../email/email.service';
import { AuthRepository } from './auth.repository';
import type { providerLoginSchema } from './dto/provider-login.dto';

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface AuthUserResult {
  id: string;
  email: string | null;
  displayName: string | null;
  platformRole: string;
}

export interface VerifyEmailLoginResult {
  user: AuthUserResult;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  redirectTo: string;
}

export interface RefreshAccessTokenResult {
  accessToken: string;
  accessTokenExpiresAt: Date;
  user: AuthUserResult;
}

export interface StartEmailLoginResult {
  ok: true;
}

interface AuthJwtPayload {
  sub: string;
  sid: string;
  type: 'access' | 'refresh';
}

interface StartEmailLoginCommand {
  email: string;
  redirectTo?: string;
}

interface VerifyEmailLoginCommand {
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly authRepository: AuthRepository,
    private readonly emailService: EmailService,
  ) {}

  async beginProviderLogin(input: z.infer<typeof providerLoginSchema>): Promise<{ provider: string }> {
    // TODO: Verify provider assertions for Telegram, WebAuthn, email magic links, Google, or Apple.
    return { provider: input.provider };
  }

  async startEmailLogin(input: StartEmailLoginCommand): Promise<StartEmailLoginResult> {
    const user = await this.authRepository.findUserByEmail(input.email);
    if (!user) {
      throw new UnauthorizedException('No account found for that email address');
    }

    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

    const redirectTo = this.normalizeRedirectTo(input.redirectTo);
    await this.authRepository.createEmailLoginToken({
      email: input.email,
      tokenHash: this.hashToken(rawToken),
      expiresAt,
      ...(redirectTo ? { redirectTo } : {}),
    });

    const url = `${this.webAppUrl}/login/verify?token=${encodeURIComponent(rawToken)}`;
    await this.emailService.sendLoginMagicLinkEmail({ email: input.email, url, expiresAt });

    return { ok: true };
  }

  async verifyEmailLogin(input: VerifyEmailLoginCommand): Promise<VerifyEmailLoginResult> {
    const loginToken = await this.authRepository.findEmailLoginToken(this.hashToken(input.token));
    if (!loginToken) {
      throw new UnauthorizedException('Invalid login link');
    }

    if (loginToken.usedAt !== null) {
      throw new BadRequestException('Login link has already been used');
    }

    if (loginToken.expiresAt.getTime() <= Date.now()) {
      throw new GoneException('Login link has expired');
    }

    const user = await this.authRepository.findOrCreateEmailUser({ email: loginToken.email });
    await this.authRepository.upsertEmailAuthAccount(user.id, loginToken.email);

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    const session = await this.authRepository.createSession({
      userId: user.id,
      type: 'user',
      refreshTokenHash: this.hashToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
    });

    const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);
    const accessToken = this.signJwt({
      sub: user.id,
      sid: session.id,
      type: 'access',
    }, ACCESS_TOKEN_TTL_SECONDS);

    await this.authRepository.consumeEmailLoginToken({ id: loginToken.id, userId: user.id });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        platformRole: user.platformRole,
      },
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      redirectTo: loginToken.redirectTo ?? '/',
    };
  }

  async verifyAccessToken(token: string): Promise<AuthJwtPayload> {
    const payload = this.verifyJwt(token);
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const session = await this.authRepository.findSession(payload.sid);
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Session is no longer active');
    }

    return payload;
  }

  async refreshAccessToken(refreshToken: string): Promise<RefreshAccessTokenResult> {
    const session = await this.authRepository.findSessionByRefreshTokenHash(this.hashToken(refreshToken));
    if (!session || session.revokedAt !== null || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh session is no longer active');
    }

    const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);
    const accessToken = this.signJwt({
      sub: session.userId,
      sid: session.id,
      type: 'access',
    }, ACCESS_TOKEN_TTL_SECONDS);

    return {
      accessToken,
      accessTokenExpiresAt,
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        platformRole: session.user.platformRole,
      },
    };
  }

  async logout(sessionId: string): Promise<{ ok: true }> {
    await this.authRepository.revokeSession(sessionId);
    return { ok: true };
  }

  private signJwt(payload: AuthJwtPayload, expiresInSeconds: number): string {
    const now = Math.floor(Date.now() / 1000);
    const header = this.base64UrlJson({ alg: 'RS256', typ: 'JWT' });
    const body = this.base64UrlJson({ ...payload, iat: now, exp: now + expiresInSeconds });
    const signature = sign('RSA-SHA256', Buffer.from(`${header}.${body}`), this.privateKey);

    return `${header}.${body}.${signature.toString('base64url')}`;
  }

  private verifyJwt(token: string): AuthJwtPayload {
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

    const result = jwtPayloadSchema
      .extend({ exp: z.number().int().positive(), iat: z.number().int().positive().optional() })
      .safeParse(decoded);
    if (!result.success || result.data.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Expired access token');
    }

    return jwtPayloadSchema.parse(result.data);
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private base64UrlJson(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private normalizeRedirectTo(value?: string): string | undefined {
    if (!value || !value.startsWith('/') || value.startsWith('//')) {
      return undefined;
    }

    return value;
  }

  private normalizePem(value: string): string {
    return value.replace(/\\n/g, '\n');
  }

  private get privateKey(): string {
    return this.normalizePem(this.config.getOrThrow<string>('JWT_ACCESS_PRIVATE_KEY'));
  }

  private get publicKey(): string {
    return this.normalizePem(this.config.getOrThrow<string>('JWT_ACCESS_PUBLIC_KEY'));
  }

  private get webAppUrl(): string {
    return this.config.getOrThrow<string>('WEB_APP_URL');
  }
}
