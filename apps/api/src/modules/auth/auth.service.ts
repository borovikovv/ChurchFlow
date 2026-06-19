import { BadGatewayException, BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createPublicKey, randomBytes, sign, verify, type JsonWebKey } from 'node:crypto';
import { z } from 'zod';
import { jwtPayloadSchema } from '@churchflow/shared';
import { AuthRepository } from './auth.repository';
import type { providerLoginSchema } from './dto/provider-login.dto';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const TELEGRAM_ISSUER = 'https://oauth.telegram.org';
const TELEGRAM_AUTHORIZATION_URL = 'https://oauth.telegram.org/auth';
const TELEGRAM_TOKEN_URL = 'https://oauth.telegram.org/token';
const TELEGRAM_JWKS_URL = 'https://oauth.telegram.org/.well-known/jwks.json';

export interface AuthUserResult {
  id: string;
  email: string | null;
  displayName: string | null;
  platformRole: string;
}

export interface RefreshAccessTokenResult {
  accessToken: string;
  accessTokenExpiresAt: Date;
  user: AuthUserResult;
}

export interface BeginTelegramLoginResult {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
  redirectTo?: string;
}

export interface CompleteTelegramLoginResult {
  user: AuthUserResult;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  redirectTo: string;
}

interface AuthJwtPayload {
  sub: string;
  sid: string;
  type: 'access' | 'refresh';
}

interface TelegramIdTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  iat: number;
  name?: string;
  preferred_username?: string;
  picture?: string;
}

interface TelegramTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token: string;
}

interface Jwk {
  kty: string;
  kid?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

interface JwksResponse {
  keys: Jwk[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {}

  beginProviderLogin(input: z.infer<typeof providerLoginSchema>): { provider: string } {
    // TODO: Verify provider assertions for provider flows that do not have dedicated endpoints yet.
    return { provider: input.provider };
  }

  beginTelegramLogin(input: { redirectTo?: string }): BeginTelegramLoginResult {
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(64).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const redirectTo = this.normalizeRedirectTo(input.redirectTo);
    const authorizationUrl = new URL(TELEGRAM_AUTHORIZATION_URL);

    authorizationUrl.searchParams.set('client_id', this.telegramClientId);
    authorizationUrl.searchParams.set('redirect_uri', this.telegramRedirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', 'openid profile');
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('code_challenge', codeChallenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');

    return {
      authorizationUrl: authorizationUrl.toString(),
      state,
      codeVerifier,
      ...(redirectTo ? { redirectTo } : {}),
    };
  }

  async completeTelegramLogin(input: {
    code: string;
    state: string;
    expectedState: string;
    codeVerifier: string;
    redirectTo?: string;
  }): Promise<CompleteTelegramLoginResult> {
    if (input.state !== input.expectedState) {
      throw new BadRequestException('Invalid Telegram login state');
    }

    const tokenResponse = await this.exchangeTelegramCode(input.code, input.codeVerifier);
    const claims = await this.verifyTelegramIdToken(tokenResponse.id_token);
    const user = await this.authRepository.findOrCreateTelegramUser({
      providerAccountId: claims.sub,
      ...(claims.name ? { displayName: claims.name } : {}),
      ...(claims.preferred_username ? { username: claims.preferred_username } : {}),
      ...(claims.picture ? { avatarUrl: claims.picture } : {}),
    });

    const session = await this.createUserSession(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        platformRole: user.platformRole,
      },
      ...session,
      redirectTo: this.normalizeRedirectTo(input.redirectTo) ?? '/',
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

  private async createUserSession(userId: string): Promise<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: Date;
    refreshTokenExpiresAt: Date;
  }> {
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    const session = await this.authRepository.createSession({
      userId,
      type: 'user',
      refreshTokenHash: this.hashToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
    });

    const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);
    const accessToken = this.signJwt({
      sub: userId,
      sid: session.id,
      type: 'access',
    }, ACCESS_TOKEN_TTL_SECONDS);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    };
  }

  private async exchangeTelegramCode(code: string, codeVerifier: string): Promise<TelegramTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.telegramRedirectUri,
      client_id: this.telegramClientId,
      code_verifier: codeVerifier,
    });
    const credentials = Buffer.from(`${this.telegramClientId}:${this.telegramClientSecret}`).toString('base64');
    const response = await fetch(TELEGRAM_TOKEN_URL, {
      method: 'POST',
      headers: {
        authorization: `Basic ${credentials}`,
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body,
    });

    if (!response.ok) {
      throw new BadGatewayException('Telegram token exchange failed');
    }

    const parsed = this.parseTelegramTokenResponse(await response.json());
    if (!parsed) {
      throw new BadGatewayException('Telegram token response was invalid');
    }

    return parsed;
  }

  private async verifyTelegramIdToken(idToken: string): Promise<TelegramIdTokenClaims> {
    const [encodedHeader, encodedPayload, encodedSignature] = idToken.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new UnauthorizedException('Invalid Telegram ID token');
    }

    const header = this.parseBase64UrlJson(encodedHeader);
    const claims = this.parseTelegramIdTokenClaims(this.parseBase64UrlJson(encodedPayload));
    if (!claims) {
      throw new UnauthorizedException('Invalid Telegram ID token claims');
    }

    if (!this.isRecord(header) || header['alg'] !== 'RS256') {
      throw new UnauthorizedException('Invalid Telegram ID token algorithm');
    }

    const jwk = await this.findTelegramJwk(typeof header['kid'] === 'string' ? header['kid'] : undefined);
    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    const isValid = verify(
      'RSA-SHA256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      publicKey,
      Buffer.from(encodedSignature, 'base64url'),
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid Telegram ID token signature');
    }

    if (
      claims.iss !== TELEGRAM_ISSUER ||
      claims.aud !== this.telegramClientId ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException('Invalid Telegram ID token claims');
    }

    return claims;
  }

  private async findTelegramJwk(kid?: string): Promise<JsonWebKey> {
    const response = await fetch(TELEGRAM_JWKS_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) {
      throw new BadGatewayException('Unable to fetch Telegram signing keys');
    }

    const body = this.parseJwksResponse(await response.json());
    if (!body) {
      throw new BadGatewayException('Telegram signing keys response was invalid');
    }

    const jwk = body.keys.find((key) => key.kty === 'RSA' && (!kid || key.kid === kid));
    if (!jwk) {
      throw new UnauthorizedException('Telegram signing key was not found');
    }

    return jwk as JsonWebKey;
  }

  private parseTelegramTokenResponse(value: unknown): TelegramTokenResponse | undefined {
    if (
      this.isRecord(value) &&
      typeof value['access_token'] === 'string' &&
      typeof value['token_type'] === 'string' &&
      typeof value['expires_in'] === 'number' &&
      typeof value['id_token'] === 'string'
    ) {
      return {
        access_token: value['access_token'],
        token_type: value['token_type'],
        expires_in: value['expires_in'],
        id_token: value['id_token'],
      };
    }

    return undefined;
  }

  private parseTelegramIdTokenClaims(value: unknown): TelegramIdTokenClaims | undefined {
    if (
      this.isRecord(value) &&
      value['iss'] === TELEGRAM_ISSUER &&
      typeof value['aud'] === 'string' &&
      typeof value['sub'] === 'string' &&
      typeof value['exp'] === 'number' &&
      typeof value['iat'] === 'number'
    ) {
      return {
        iss: value['iss'],
        aud: value['aud'],
        sub: value['sub'],
        exp: value['exp'],
        iat: value['iat'],
        ...(typeof value['name'] === 'string' ? { name: value['name'] } : {}),
        ...(typeof value['preferred_username'] === 'string'
          ? { preferred_username: value['preferred_username'] }
          : {}),
        ...(typeof value['picture'] === 'string' ? { picture: value['picture'] } : {}),
      };
    }

    return undefined;
  }

  private parseJwksResponse(value: unknown): JwksResponse | undefined {
    if (this.isRecord(value) && Array.isArray(value['keys'])) {
      const keys = value['keys'].map((key) => this.parseJwk(key));

      if (keys.every((key): key is Jwk => key !== undefined)) {
        return { keys };
      }
    }

    return undefined;
  }

  private parseJwk(value: unknown): Jwk | undefined {
    if (!this.isRecord(value) || typeof value['kty'] !== 'string') {
      return undefined;
    }

    return {
      kty: value['kty'],
      ...(typeof value['kid'] === 'string' ? { kid: value['kid'] } : {}),
      ...(typeof value['alg'] === 'string' ? { alg: value['alg'] } : {}),
      ...(typeof value['use'] === 'string' ? { use: value['use'] } : {}),
      ...(typeof value['n'] === 'string' ? { n: value['n'] } : {}),
      ...(typeof value['e'] === 'string' ? { e: value['e'] } : {}),
    };
  }

  private parseBase64UrlJson(value: string): unknown {
    try {
      return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    } catch {
      throw new UnauthorizedException('Invalid Telegram ID token');
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
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

  private get telegramClientId(): string {
    return this.config.getOrThrow<string>('TELEGRAM_CLIENT_ID');
  }

  private get telegramClientSecret(): string {
    return this.config.getOrThrow<string>('TELEGRAM_CLIENT_SECRET');
  }

  private get telegramRedirectUri(): string {
    return this.config.getOrThrow<string>('TELEGRAM_REDIRECT_URI');
  }

}
