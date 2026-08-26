import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { resolveAppLocaleFromAcceptLanguage, type AppLocale } from '@churchflow/shared';
import { normalizeLoginEmail } from '../../../common/auth/email-identity';
import {
  generateEmailLoginCode,
  hashEmailLoginCode,
  verifyEmailLoginCode,
} from '../../../common/auth/email-login-code';
import {
  extractRedirectToken,
  normalizeInternalRedirect,
} from '../../../common/auth/internal-redirect';
import { hashOpaqueToken } from '../../../common/auth/session-token';
import { UserLocaleService } from '../../../common/locale/user-locale.service';
import { AuditService } from '../../audit/audit.service';
import { EmailService } from '../../email/email.service';
import { AuthRepository } from '../auth.repository';
import { AuthService } from '../auth.service';
import { EmailAuthRepository } from './email-auth.repository';
import { hasStandingToSignIn, resolveLoginRedirect, type LoginUserState } from '../login-state';
import { EMAIL_LOGIN_MAX_CODE_ATTEMPTS, emailLoginTokenExpiresAt } from './email-login-policy';

export interface EmailAuthClientContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface CompleteEmailVerificationResult {
  redirectTo: string;
}

export interface CompleteEmailSignInResult {
  sessionToken: string;
  sessionExpiresAt: Date;
  redirectTo: string;
}

interface EmailLoginAdmission {
  // Null means the address is admitted but has no account yet, so signing in creates one.
  state: LoginUserState | null;
  // A redirect carrying a valid invitation, bootstrap or member-claim token is a credential
  // in its own right, and the caller is sent back to the page it came from.
  admittedByRedirect: boolean;
}

@Injectable()
export class EmailAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly repository: EmailAuthRepository,
    private readonly authRepository: AuthRepository,
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    private readonly userLocaleService: UserLocaleService,
    private readonly auditService: AuditService,
  ) {}

  async requestEmailVerification(
    userId: string,
    client: EmailAuthClientContext,
  ): Promise<{ ok: true }> {
    const candidate = await this.repository.findVerificationCandidate(userId);
    if (!candidate) {
      throw new BadRequestException('Add an email address to your profile first');
    }

    if (candidate.emailVerified) {
      throw new ConflictException('This email address is already verified');
    }

    const email = normalizeLoginEmail(candidate.email);
    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = emailLoginTokenExpiresAt(new Date());

    await this.repository.issueToken({
      email,
      purpose: 'verify_email',
      tokenHash: hashOpaqueToken(rawToken),
      expiresAt,
      userId,
      ...(client.ipAddress ? { requestIp: client.ipAddress } : {}),
      ...(client.userAgent ? { userAgent: client.userAgent } : {}),
    });

    await this.emailService.sendEmailVerificationEmail({
      locale: await this.userLocaleService.forUser(userId),
      email,
      token: rawToken,
      expiresAt,
    });

    await this.auditService.record({
      actorUserId: userId,
      action: 'UPDATE',
      entityType: 'User',
      entityId: userId,
      metadata: { event: 'email_verification_requested' },
    });

    return { ok: true };
  }

  async completeEmailVerification(token: string): Promise<CompleteEmailVerificationResult> {
    const verified = await this.repository.consumeVerificationToken(hashOpaqueToken(token));
    if (!verified) {
      throw new BadRequestException('This verification link is no longer valid');
    }

    await this.auditService.record({
      actorUserId: verified.userId,
      action: 'UPDATE',
      entityType: 'User',
      entityId: verified.userId,
      metadata: { event: 'email_verified' },
    });

    return { redirectTo: '/profile?emailVerified=1' };
  }

  // Callers are never told whether an address can sign in: the answer is the same either
  // way, so the endpoint cannot be used to enumerate accounts.
  async requestSignIn(input: {
    email: string;
    redirectTo?: string;
    acceptLanguage?: string;
    client: EmailAuthClientContext;
  }): Promise<void> {
    const email = normalizeLoginEmail(input.email);
    const redirectTo = normalizeInternalRedirect(input.redirectTo, this.webAppUrl) ?? null;
    const admission = await this.resolveAdmission(email, redirectTo);
    if (!admission) {
      return;
    }

    const rawToken = randomBytes(32).toString('base64url');
    const code = generateEmailLoginCode();
    const expiresAt = emailLoginTokenExpiresAt(new Date());

    await this.repository.issueToken({
      email,
      purpose: 'sign_in',
      tokenHash: hashOpaqueToken(rawToken),
      codeHash: await hashEmailLoginCode(code),
      expiresAt,
      ...(admission.state ? { userId: admission.state.user.id } : {}),
      ...(redirectTo ? { redirectTo } : {}),
      ...(input.client.ipAddress ? { requestIp: input.client.ipAddress } : {}),
      ...(input.client.userAgent ? { userAgent: input.client.userAgent } : {}),
    });

    await this.emailService.sendEmailSignInEmail({
      locale: await this.signInLocale(email, input.acceptLanguage),
      email,
      token: rawToken,
      code,
      expiresAt,
    });
  }

  async completeSignInWithToken(
    token: string,
    client: EmailAuthClientContext,
  ): Promise<CompleteEmailSignInResult> {
    const consumed = await this.repository.consumeSignInTokenByHash(hashOpaqueToken(token));
    if (!consumed) {
      throw new UnauthorizedException('This sign-in link is no longer valid');
    }

    return this.admitSignIn(consumed.email, consumed.redirectTo, client);
  }

  async completeSignInWithCode(
    input: { email: string; code: string },
    client: EmailAuthClientContext,
  ): Promise<CompleteEmailSignInResult> {
    const email = normalizeLoginEmail(input.email);
    const token = await this.repository.findLiveSignInToken(email);
    if (!token?.codeHash) {
      throw new UnauthorizedException('This sign-in code is no longer valid');
    }

    const matches = await verifyEmailLoginCode(input.code, token.codeHash);
    if (!matches) {
      const attempts = token.attemptCount + 1;
      await this.repository.recordFailedCodeAttempt(
        token.id,
        attempts >= EMAIL_LOGIN_MAX_CODE_ATTEMPTS,
      );
      throw new UnauthorizedException('This sign-in code is no longer valid');
    }

    if (!(await this.repository.consumeSignInTokenById(token.id))) {
      throw new UnauthorizedException('This sign-in code is no longer valid');
    }

    return this.admitSignIn(email, token.redirectTo, client);
  }

  private async admitSignIn(
    email: string,
    requestedRedirect: string | null,
    client: EmailAuthClientContext,
  ): Promise<CompleteEmailSignInResult> {
    // Admission is resolved again on use, not trusted from when the mail was sent: access
    // can be revoked inside the window the token is valid for.
    const admission = await this.resolveAdmission(email, requestedRedirect);
    if (!admission) {
      throw new UnauthorizedException('This account cannot sign in with email');
    }

    const state = admission.state ?? (await this.createAdmittedAccount(email));

    await this.repository.touchEmailAccount(state.user.id);
    const session = await this.authService.createUserSession(state.user.id, client);

    await this.auditService.record({
      actorUserId: state.user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: state.user.id,
      metadata: { provider: 'email' },
    });

    return {
      ...session,
      redirectTo: resolveLoginRedirect(state, requestedRedirect, admission.admittedByRedirect),
    };
  }

  private async createAdmittedAccount(email: string): Promise<LoginUserState> {
    await this.repository.createAdmittedEmailUser({ email });
    const state = await this.repository.findLoginAccountState(email);
    if (!state) {
      throw new UnauthorizedException('This account cannot sign in with email');
    }

    return state;
  }

  private async resolveAdmission(
    email: string,
    redirectTo: string | null,
  ): Promise<EmailLoginAdmission | null> {
    const admittedByRedirect = await this.hasAdmittingRedirect(redirectTo);
    const state = await this.repository.findLoginAccountState(email);

    if (!state) {
      return admittedByRedirect ? { state: null, admittedByRedirect } : null;
    }

    // An address only becomes an identity once its owner has proved they hold it. Anything
    // an administrator typed into a profile is contact data until then, so a link handed to
    // somebody else cannot be pointed at an account that never claimed its address.
    if (!state.isEmailVerified) {
      return null;
    }

    return hasStandingToSignIn(state) || admittedByRedirect ? { state, admittedByRedirect } : null;
  }

  // The token inside the redirect is the credential here, not the address: whoever holds a
  // live claimable invitation, first-admin bootstrap or member-claim link may sign in with
  // the mailbox they can prove they own. Organization onboarding is deliberately absent —
  // it carries no token, so accepting it would make email sign-up open to anyone.
  private async hasAdmittingRedirect(redirectTo: string | null): Promise<boolean> {
    const candidates: ReadonlyArray<[string, (tokenHash: string) => Promise<boolean>]> = [
      [
        '/invitations/accept',
        (tokenHash) => this.authRepository.hasValidClaimableInvitationTokenHash(tokenHash),
      ],
      [
        '/platform-admin/bootstrap',
        (tokenHash) => this.authRepository.hasValidPlatformAdminBootstrapTokenHash(tokenHash),
      ],
      [
        '/member-claims/accept',
        (tokenHash) => this.authRepository.hasValidMembershipClaimTokenHash(tokenHash),
      ],
    ];

    for (const [path, isValid] of candidates) {
      const token = extractRedirectToken(redirectTo ?? undefined, path);
      if (token && (await isValid(hashOpaqueToken(token)))) {
        return true;
      }
    }

    return false;
  }

  private async signInLocale(email: string, acceptLanguage?: string): Promise<AppLocale> {
    return (
      (await this.userLocaleService.forEmail(email)) ??
      resolveAppLocaleFromAcceptLanguage(acceptLanguage)
    );
  }

  private get webAppUrl(): string {
    return this.config.getOrThrow<string>('WEB_APP_URL');
  }
}
