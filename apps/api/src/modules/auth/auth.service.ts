import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createPublicKey, randomBytes, verify, type JsonWebKey } from 'node:crypto';
import { z } from 'zod';
import type { UserSession } from '@churchflow/shared';
import { deviceLabelFromUserAgent } from '../../common/auth/device-label';
import {
  SESSION_ABSOLUTE_TTL_SECONDS,
  SESSION_IDLE_TTL_SECONDS,
} from '../../common/auth/session-policy';
import { AuthRepository } from './auth.repository';
import type { providerLoginSchema } from './dto/provider-login.dto';
import { SESSION_RETENTION_BATCH_SIZE, SESSION_RETENTION_MAX_BATCHES } from './session-retention';

const TELEGRAM_ISSUER = 'https://oauth.telegram.org';
const TELEGRAM_AUTHORIZATION_URL = 'https://oauth.telegram.org/auth';
const TELEGRAM_TOKEN_URL = 'https://oauth.telegram.org/token';
const TELEGRAM_JWKS_URL = 'https://oauth.telegram.org/.well-known/jwks.json';
const TELEGRAM_CLOCK_SKEW_SECONDS = 5 * 60;
const MAX_TELEGRAM_SUB_LENGTH = 255;
const UNSAFE_ENCODED_REDIRECT_CHARACTERS = /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i;

export interface AuthUserResult {
  id: string;
  email: string | null;
  displayName: string | null;
  platformRole: string;
}

export interface SessionClientContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface BeginTelegramLoginResult {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
  nonce: string;
  redirectTo?: string;
}

export interface CompleteTelegramLoginResult {
  user: AuthUserResult;
  sessionToken: string;
  sessionExpiresAt: Date;
  redirectTo: string;
}

interface TelegramIdTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  iat: number;
  nonce: string;
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

interface AuthRepositoryUser {
  id: string;
  email: string | null;
  displayName: string | null;
  platformRole: string;
}

interface TelegramLoginAccountState {
  accountId: string;
  user: AuthRepositoryUser;
  isActive: boolean;
  hasActiveMembership: boolean;
  hasOrganizationRequest: boolean;
  hasPendingOrganizationRequest: boolean;
  hasMembershipClaim: boolean;
  isPlatformAdmin: boolean;
}

interface TelegramLoginResolution {
  user: AuthUserResult;
  defaultRedirectTo: string;
  useRequestedRedirect: boolean;
}

interface RequestedRedirectPolicyInput {
  redirectTo: string | undefined;
  hasActiveMembership: boolean;
  hasClaimableInvitationRedirect: boolean;
  hasPlatformAdminBootstrapRedirect: boolean;
  hasMembershipClaimRedirect: boolean;
}

interface CreateSessionInput {
  userId: string;
  type: 'user' | 'service';
  tokenHash: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
}

interface CreatedSession {
  id: string;
}

type SessionRevokeReason = 'logout' | 'user_revoked' | 'admin' | 'expired' | 'user_deleted';

interface UserSessionRecord {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
}

interface AuthRepositoryPort {
  hasPendingTelegramInvitation(providerAccountId: string): Promise<boolean>;
  hasValidClaimableInvitationTokenHash(tokenHash: string): Promise<boolean>;
  hasValidPlatformAdminBootstrapTokenHash(tokenHash: string): Promise<boolean>;
  hasValidMembershipClaimTokenHash(tokenHash: string): Promise<boolean>;
  findTelegramLoginAccountState(
    providerAccountId: string,
  ): Promise<TelegramLoginAccountState | null>;
  createTelegramUserForAdmission(input: {
    providerAccountId: string;
    displayName?: string;
    username?: string;
    avatarUrl?: string;
  }): Promise<AuthRepositoryUser>;
  touchTelegramAccount(accountId: string, username?: string): Promise<AuthRepositoryUser>;
  createSession(input: CreateSessionInput): Promise<CreatedSession>;
  revokeSessionByTokenHash(tokenHash: string, reason: SessionRevokeReason): Promise<number>;
  listUserSessions(userId: string): Promise<UserSessionRecord[]>;
  revokeUserSession(
    sessionId: string,
    userId: string,
    reason: SessionRevokeReason,
  ): Promise<number>;
  revokeOtherUserSessions(
    userId: string,
    keptSessionId: string,
    reason: SessionRevokeReason,
  ): Promise<number>;
  countPurgeableSessions(cutoff: Date): Promise<number>;
  purgeSessions(input: {
    cutoff: Date;
    batchSize: number;
    maxBatches: number;
  }): Promise<{ deletedCount: number; exhausted: boolean }>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(AuthRepository) private readonly authRepository: AuthRepositoryPort,
  ) {}

  beginProviderLogin(input: z.infer<typeof providerLoginSchema>): { provider: string } {
    // TODO: Verify provider assertions for provider flows that do not have dedicated endpoints yet.
    return { provider: input.provider };
  }

  beginTelegramLogin(input: { redirectTo?: string }): BeginTelegramLoginResult {
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(64).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const redirectTo = this.normalizeRedirectTo(input.redirectTo);
    const authorizationUrl = new URL(TELEGRAM_AUTHORIZATION_URL);

    authorizationUrl.searchParams.set('client_id', this.telegramClientId);
    authorizationUrl.searchParams.set('redirect_uri', this.telegramRedirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', 'openid profile');
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('nonce', nonce);
    authorizationUrl.searchParams.set('code_challenge', codeChallenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');

    return {
      authorizationUrl: authorizationUrl.toString(),
      state,
      codeVerifier,
      nonce,
      ...(redirectTo ? { redirectTo } : {}),
    };
  }

  async completeTelegramLogin(input: {
    code: string;
    state: string;
    expectedState: string;
    codeVerifier: string;
    expectedNonce: string;
    redirectTo?: string;
    client: SessionClientContext;
  }): Promise<CompleteTelegramLoginResult> {
    if (input.state !== input.expectedState) {
      throw new BadRequestException('Invalid Telegram login state');
    }

    const tokenResponse = await this.exchangeTelegramCode(input.code, input.codeVerifier);
    const claims = await this.verifyTelegramIdToken(tokenResponse.id_token, input.expectedNonce);
    const redirectTo = this.normalizeRedirectTo(input.redirectTo);
    const { user, defaultRedirectTo, useRequestedRedirect } = await this.resolveTelegramLoginUser(
      claims,
      redirectTo,
    );

    const session = await this.createUserSession(user.id, input.client);

    return {
      user,
      ...session,
      redirectTo: useRequestedRedirect && redirectTo ? redirectTo : defaultRedirectTo,
    };
  }

  private async resolveTelegramLoginUser(
    claims: TelegramIdTokenClaims,
    redirectTo?: string,
  ): Promise<TelegramLoginResolution> {
    const hasPendingInvitation = await this.authRepository.hasPendingTelegramInvitation(claims.sub);
    const hasClaimableInvitationRedirect =
      await this.hasValidClaimableInvitationRedirect(redirectTo);
    const hasPlatformAdminBootstrapRedirect =
      await this.hasValidPlatformAdminBootstrapRedirect(redirectTo);
    const hasOrganizationOnboardingRedirect = this.isOrganizationOnboardingRedirect(redirectTo);
    const hasMembershipClaimRedirect = await this.hasValidMembershipClaimRedirect(redirectTo);
    const accountState = await this.authRepository.findTelegramLoginAccountState(claims.sub);

    if (!accountState) {
      if (
        !hasPendingInvitation &&
        !hasClaimableInvitationRedirect &&
        !hasPlatformAdminBootstrapRedirect &&
        !hasOrganizationOnboardingRedirect &&
        !hasMembershipClaimRedirect
      ) {
        throw new UnauthorizedException('Account is not invited to ChurchFlow');
      }

      let createdUser: AuthRepositoryUser;
      try {
        createdUser = await this.authRepository.createTelegramUserForAdmission({
          providerAccountId: claims.sub,
          ...(claims.name ? { displayName: claims.name } : {}),
          ...(claims.preferred_username ? { username: claims.preferred_username } : {}),
          ...(claims.picture ? { avatarUrl: claims.picture } : {}),
        });
      } catch (error: unknown) {
        if (error instanceof Error && error.message === 'TELEGRAM_ACCOUNT_INACTIVE') {
          throw new UnauthorizedException('Telegram account is not active');
        }
        throw error;
      }

      return {
        user: this.toAuthUserResult(createdUser),
        useRequestedRedirect: this.canUseRequestedRedirect({
          redirectTo,
          hasActiveMembership: false,
          hasClaimableInvitationRedirect,
          hasPlatformAdminBootstrapRedirect,
          hasMembershipClaimRedirect,
        }),
        defaultRedirectTo: hasPendingInvitation
          ? '/invitations/pending'
          : hasMembershipClaimRedirect
            ? (redirectTo ?? '/member-claims/accept')
            : hasOrganizationOnboardingRedirect
              ? (redirectTo ?? '/organization-request')
              : (redirectTo ?? '/'),
      };
    }

    if (!accountState.isActive) {
      throw new UnauthorizedException('Telegram account is not active');
    }

    if (
      !accountState.hasActiveMembership &&
      !accountState.isPlatformAdmin &&
      !accountState.hasOrganizationRequest &&
      !accountState.hasMembershipClaim &&
      !hasPendingInvitation &&
      !hasClaimableInvitationRedirect &&
      !hasPlatformAdminBootstrapRedirect &&
      !hasOrganizationOnboardingRedirect &&
      !hasMembershipClaimRedirect
    ) {
      throw new UnauthorizedException('Account is not associated with an organization');
    }

    const touchedUser = await this.authRepository.touchTelegramAccount(
      accountState.accountId,
      claims.preferred_username,
    );

    return {
      user: this.toAuthUserResult(touchedUser),
      useRequestedRedirect: this.canUseRequestedRedirect({
        redirectTo,
        hasActiveMembership: accountState.hasActiveMembership,
        hasClaimableInvitationRedirect,
        hasPlatformAdminBootstrapRedirect,
        hasMembershipClaimRedirect,
      }),
      defaultRedirectTo: accountState.isPlatformAdmin
        ? '/admin/organizations'
        : !accountState.hasActiveMembership && accountState.hasOrganizationRequest
          ? '/organization-request/status'
          : !accountState.hasActiveMembership && accountState.hasMembershipClaim
            ? '/member-claims/status'
            : !accountState.hasActiveMembership && hasPendingInvitation
              ? '/invitations/pending'
              : !accountState.hasActiveMembership &&
                  (hasClaimableInvitationRedirect || hasPlatformAdminBootstrapRedirect)
                ? (redirectTo ?? '/')
                : !accountState.hasActiveMembership && hasMembershipClaimRedirect
                  ? (redirectTo ?? '/member-claims/accept')
                  : '/',
    };
  }

  private hasValidClaimableInvitationRedirect(redirectTo?: string): Promise<boolean> {
    const token = this.extractInvitationTokenFromRedirect(redirectTo);
    if (!token) {
      return Promise.resolve(false);
    }

    return this.authRepository.hasValidClaimableInvitationTokenHash(this.hashToken(token));
  }

  private hasValidPlatformAdminBootstrapRedirect(redirectTo?: string): Promise<boolean> {
    const token = this.extractTokenFromRedirect(redirectTo, '/platform-admin/bootstrap');
    if (!token) {
      return Promise.resolve(false);
    }

    return this.authRepository.hasValidPlatformAdminBootstrapTokenHash(this.hashToken(token));
  }

  private hasValidMembershipClaimRedirect(redirectTo?: string): Promise<boolean> {
    const token = this.extractTokenFromRedirect(redirectTo, '/member-claims/accept');
    if (!token) return Promise.resolve(false);
    return this.authRepository.hasValidMembershipClaimTokenHash(this.hashToken(token));
  }

  private extractInvitationTokenFromRedirect(redirectTo?: string): string | null {
    return this.extractTokenFromRedirect(redirectTo, '/invitations/accept');
  }

  private isOrganizationOnboardingRedirect(redirectTo?: string): boolean {
    const url = this.parseInternalRedirectUrl(redirectTo);
    return (
      url !== null &&
      (url.pathname === '/organization-request' || url.pathname === '/organization-request/status')
    );
  }

  private canUseRequestedRedirect(input: RequestedRedirectPolicyInput): boolean {
    if (!input.redirectTo) {
      return false;
    }

    if (this.matchesRedirectPath(input.redirectTo, '/invitations/accept')) {
      return input.hasClaimableInvitationRedirect;
    }

    if (this.matchesRedirectPath(input.redirectTo, '/member-claims/accept')) {
      return input.hasMembershipClaimRedirect;
    }

    if (this.matchesRedirectPath(input.redirectTo, '/platform-admin/bootstrap')) {
      return input.hasPlatformAdminBootstrapRedirect;
    }

    if (this.isOrganizationOnboardingRedirect(input.redirectTo)) {
      return !input.hasActiveMembership;
    }

    return true;
  }

  private matchesRedirectPath(redirectTo: string | undefined, path: string): boolean {
    const url = this.parseInternalRedirectUrl(redirectTo);

    return url !== null && url.pathname === path;
  }

  private extractTokenFromRedirect(redirectTo: string | undefined, path: string): string | null {
    if (!redirectTo) {
      return null;
    }

    const queryIndex = redirectTo.indexOf('?');
    if (queryIndex < 0 || redirectTo.slice(0, queryIndex) !== path) {
      return null;
    }

    return new URLSearchParams(redirectTo.slice(queryIndex + 1)).get('token');
  }

  private toAuthUserResult(user: {
    id: string;
    email: string | null;
    displayName: string | null;
    platformRole: string;
  }): AuthUserResult {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      platformRole: user.platformRole,
    };
  }

  async logoutByToken(sessionToken: string): Promise<{ ok: true }> {
    await this.authRepository.revokeSessionByTokenHash(this.hashToken(sessionToken), 'logout');
    return { ok: true };
  }

  async listSessions(userId: string, currentSessionId: string): Promise<UserSession[]> {
    const sessions = await this.authRepository.listUserSessions(userId);

    return sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      ipAddress: session.ipAddress,
      lastUsedAt: session.lastUsedAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<{ ok: true }> {
    const revoked = await this.authRepository.revokeUserSession(sessionId, userId, 'user_revoked');
    if (revoked === 0) {
      throw new NotFoundException('Session was not found');
    }

    return { ok: true };
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<{ revokedCount: number }> {
    const revokedCount = await this.authRepository.revokeOtherUserSessions(
      userId,
      currentSessionId,
      'user_revoked',
    );

    return { revokedCount };
  }

  async purgeExpiredSessions(input: { cutoff: Date; dryRun: boolean }) {
    if (input.dryRun) {
      return { deletedCount: await this.authRepository.countPurgeableSessions(input.cutoff) };
    }

    const purged = await this.authRepository.purgeSessions({
      cutoff: input.cutoff,
      batchSize: SESSION_RETENTION_BATCH_SIZE,
      maxBatches: SESSION_RETENTION_MAX_BATCHES,
    });

    if (purged.exhausted) {
      this.logger.warn({
        event: 'Session retention hit the batch limit before draining the backlog',
        cutoff: input.cutoff.toISOString(),
        deletedCount: purged.deletedCount,
      });
    }

    return { deletedCount: purged.deletedCount };
  }

  private async createUserSession(
    userId: string,
    client: SessionClientContext,
  ): Promise<{
    sessionToken: string;
    sessionExpiresAt: Date;
  }> {
    const sessionToken = randomBytes(48).toString('base64url');
    const now = Date.now();
    const expiresAt = new Date(now + SESSION_IDLE_TTL_SECONDS * 1000);
    const deviceName = deviceLabelFromUserAgent(client.userAgent);
    await this.authRepository.createSession({
      userId,
      type: 'user',
      tokenHash: this.hashToken(sessionToken),
      expiresAt,
      absoluteExpiresAt: new Date(now + SESSION_ABSOLUTE_TTL_SECONDS * 1000),
      ...(deviceName ? { deviceName } : {}),
      ...(client.userAgent ? { userAgent: client.userAgent } : {}),
      ...(client.ipAddress ? { ipAddress: client.ipAddress } : {}),
    });

    return { sessionToken, sessionExpiresAt: expiresAt };
  }

  private async exchangeTelegramCode(
    code: string,
    codeVerifier: string,
  ): Promise<TelegramTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.telegramRedirectUri,
      client_id: this.telegramClientId,
      code_verifier: codeVerifier,
    });
    const credentials = Buffer.from(
      `${this.telegramClientId}:${this.telegramClientSecret}`,
    ).toString('base64');
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

  private async verifyTelegramIdToken(
    idToken: string,
    expectedNonce: string,
  ): Promise<TelegramIdTokenClaims> {
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

    const jwk = await this.findTelegramJwk(
      typeof header['kid'] === 'string' ? header['kid'] : undefined,
    );
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

    const now = Math.floor(Date.now() / 1000);
    if (
      claims.iss !== TELEGRAM_ISSUER ||
      claims.aud !== this.telegramClientId ||
      claims.exp <= now ||
      claims.iat > now + TELEGRAM_CLOCK_SKEW_SECONDS ||
      claims.nonce !== expectedNonce ||
      claims.sub.trim().length === 0 ||
      claims.sub.length > MAX_TELEGRAM_SUB_LENGTH
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
      typeof value['iat'] === 'number' &&
      typeof value['nonce'] === 'string'
    ) {
      return {
        iss: value['iss'],
        aud: value['aud'],
        sub: value['sub'],
        exp: value['exp'],
        iat: value['iat'],
        nonce: value['nonce'],
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

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private normalizeRedirectTo(value?: string): string | undefined {
    if (
      !value ||
      this.hasUnsafeRedirectCharacters(value) ||
      UNSAFE_ENCODED_REDIRECT_CHARACTERS.test(value)
    ) {
      return undefined;
    }

    const redirectUrl = this.parseInternalRedirectUrl(value);
    if (!redirectUrl) {
      return undefined;
    }

    return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
  }

  private parseInternalRedirectUrl(value: string | undefined): URL | null {
    if (!value) {
      return null;
    }

    try {
      const appUrl = new URL(this.webAppUrl);
      const redirectUrl = new URL(value, appUrl);

      return redirectUrl.origin === appUrl.origin ? redirectUrl : null;
    } catch {
      return null;
    }
  }

  private hasUnsafeRedirectCharacters(value: string): boolean {
    return Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0);
      return character === '\\' || codePoint === undefined || codePoint <= 31 || codePoint === 127;
    });
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

  private get webAppUrl(): string {
    return this.config.getOrThrow<string>('WEB_APP_URL');
  }
}
