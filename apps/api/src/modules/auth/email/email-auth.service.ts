import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { resolveAppLocaleFromAcceptLanguage, type AppLocale } from '@churchflow/shared';
import { normalizeLoginEmail } from '../../../common/auth/email-identity';
import type { RequestClientContext } from '../../../common/auth/request-client-context';
import {
  generateEmailLoginCode,
  hashEmailLoginCode,
  verifyEmailLoginCode,
} from '../../../common/auth/email-login-code';
import { normalizeInternalRedirect } from '../../../common/auth/internal-redirect';
import { hashOpaqueToken } from '../../../common/auth/session-token';
import { hasAdmittingRedirect, redirectPath } from '../admitting-redirect';
import { UserLocaleService } from '../../../common/locale/user-locale.service';
import { AuditService } from '../../audit/audit.service';
import { EmailService } from '../../email/email.service';
import { AuthRepository } from '../auth.repository';
import { AuthService } from '../auth.service';
import { EmailAuthRepository, type LiveEmailSignInToken } from './email-auth.repository';
import { hasStandingToSignIn, resolveLoginRedirect, type LoginUserState } from '../login-state';
import {
  EMAIL_LOGIN_REQUESTS_PER_WINDOW,
  emailLoginRequestWindowStart,
  emailLoginTokenExpiresAt,
} from './email-login-policy';

export interface CompleteEmailVerificationResult {
  redirectTo: string;
}

export interface CompleteEmailSignInResult {
  sessionToken: string;
  sessionExpiresAt: Date;
  redirectTo: string;
}

// Why an address was turned away. The caller is told none of this on purpose, so it is the
// only place the answer exists: without it a sign-in email that never arrives leaves nothing
// behind to explain itself.
type EmailLoginRefusal = 'unknown_address_without_admitting_redirect' | 'no_standing_to_sign_in';

interface EmailLoginAdmission {
  admitted: true;
  // Null means the address is admitted but has no account yet, so signing in creates one.
  state: LoginUserState | null;
  // A redirect carrying a valid invitation, bootstrap or member-claim token is a credential
  // in its own right, and the caller is sent back to the page it came from.
  admittedByRedirect: boolean;
}

interface EmailLoginRefused {
  admitted: false;
  reason: EmailLoginRefusal;
}

@Injectable()
export class EmailAuthService {
  private readonly logger = new Logger(EmailAuthService.name);

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
    client: RequestClientContext,
  ): Promise<{ ok: true }> {
    const candidate = await this.repository.findVerificationCandidate(userId);
    if (!candidate) {
      throw new BadRequestException('Add an email address to your profile first');
    }

    if (candidate.emailVerified) {
      throw new ConflictException('This email address is already verified');
    }

    const email = normalizeLoginEmail(candidate.email);
    if (await this.hasExhaustedRequests(email, 'verify_email')) {
      throw new HttpException(
        'Too many confirmation emails were requested. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

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

    // No success flag needed: the profile reads the confirmation off the account itself, so
    // it will already say the address is confirmed by the time the page renders.
    return { redirectTo: '/profile' };
  }

  // Callers are never told whether an address can sign in: the answer is the same either
  // way, so the endpoint cannot be used to enumerate accounts.
  async requestSignIn(input: {
    email: string;
    redirectTo?: string;
    acceptLanguage?: string;
    client: RequestClientContext;
  }): Promise<void> {
    const email = normalizeLoginEmail(input.email);
    const redirectTo = normalizeInternalRedirect(input.redirectTo, this.webAppUrl) ?? null;
    const admission = await this.resolveAdmission(email, redirectTo);
    if (!admission.admitted) {
      this.logger.warn({
        event: 'Sign-in email refused before it was sent',
        reason: admission.reason,
        // The path only. The token inside the redirect is a credential and stays out of logs.
        redirectPath: redirectPath(redirectTo),
      });
      return;
    }

    // Stopping here is silent for the same reason the whole endpoint is: telling the caller
    // they hit a limit would tell them the address was worth limiting.
    if (await this.hasExhaustedRequests(email, 'sign_in')) {
      this.logger.warn({ event: 'Sign-in link requests exhausted for an address' });
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

    // The answer to this endpoint must not depend on whether the address is admitted, and a
    // provider outage would otherwise say it out loud: 500 for addresses that can sign in,
    // 202 for every other. The failure is recorded here rather than told to the caller.
    try {
      await this.emailService.sendEmailSignInEmail({
        locale: await this.signInLocale(email, input.acceptLanguage),
        email,
        token: rawToken,
        code,
        expiresAt,
      });
    } catch (error: unknown) {
      this.logger.error(
        'Sign-in email failed after the token was issued',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async completeSignInWithToken(
    token: string,
    client: RequestClientContext,
    acceptLanguage?: string,
  ): Promise<CompleteEmailSignInResult> {
    const consumed = await this.repository.consumeSignInTokenByHash(hashOpaqueToken(token));
    if (!consumed) {
      throw new UnauthorizedException('This sign-in link is no longer valid');
    }

    return this.admitSignIn(consumed.email, consumed.redirectTo, client, acceptLanguage);
  }

  async completeSignInWithCode(
    input: { email: string; code: string },
    client: RequestClientContext,
    acceptLanguage?: string,
  ): Promise<CompleteEmailSignInResult> {
    const email = normalizeLoginEmail(input.email);
    // More than one token can be live for an address, because asking for a new link no longer
    // retires the older ones. The code being offered may belong to any of them.
    const live = await this.repository.findLiveSignInTokens(email);
    const token = await this.matchingSignInToken(input.code, live);

    if (!token) {
      // Counted against every live token, so issuing more of them never buys more guesses.
      if (live.length > 0) {
        await this.repository.recordFailedCodeAttempts(email);
      }

      throw new UnauthorizedException('This sign-in code is no longer valid');
    }

    // Losing the race to consume is not a wrong guess, so it costs no attempt.
    if (!(await this.repository.consumeSignInTokenById(token.id))) {
      throw new UnauthorizedException('This sign-in code is no longer valid');
    }

    return this.admitSignIn(email, token.redirectTo, client, acceptLanguage);
  }

  private async matchingSignInToken(
    code: string,
    tokens: ReadonlyArray<LiveEmailSignInToken>,
  ): Promise<LiveEmailSignInToken | null> {
    for (const token of tokens) {
      if (token.codeHash && (await verifyEmailLoginCode(code, token.codeHash))) {
        return token;
      }
    }

    return null;
  }

  private async admitSignIn(
    email: string,
    requestedRedirect: string | null,
    client: RequestClientContext,
    acceptLanguage?: string,
  ): Promise<CompleteEmailSignInResult> {
    // Admission is resolved again on use, not trusted from when the mail was sent: access
    // can be revoked inside the window the token is valid for.
    const admission = await this.resolveAdmission(email, requestedRedirect);
    if (!admission.admitted) {
      this.logger.warn({
        event: 'Sign-in refused while the token was being redeemed',
        reason: admission.reason,
        redirectPath: redirectPath(requestedRedirect),
      });
      throw new UnauthorizedException('This account cannot sign in with email');
    }

    const state = admission.state ?? (await this.createAdmittedAccount(email, acceptLanguage));

    if (state.isEmailVerified) {
      await this.repository.touchEmailAccount(state.user.id);
    } else {
      // The mail came back, so the address stops being contact data and becomes the identity
      // it was always meant to be, exactly as a verification link would have left it.
      await this.repository.confirmEmailIdentity(state.user.id, email);
      await this.auditService.record({
        actorUserId: state.user.id,
        action: 'UPDATE',
        entityType: 'User',
        entityId: state.user.id,
        metadata: { event: 'email_verified' },
      });
    }

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

  // The account is created here rather than when the mail was sent, so the language comes from
  // the browser redeeming the token: that is the one the new account is about to be used in.
  private async createAdmittedAccount(
    email: string,
    acceptLanguage?: string,
  ): Promise<LoginUserState> {
    await this.repository.createAdmittedEmailUser({
      email,
      locale: resolveAppLocaleFromAcceptLanguage(acceptLanguage),
    });
    const state = await this.repository.findLoginAccountState(email);
    if (!state) {
      throw new UnauthorizedException('This account cannot sign in with email');
    }

    return state;
  }

  private async resolveAdmission(
    email: string,
    redirectTo: string | null,
  ): Promise<EmailLoginAdmission | EmailLoginRefused> {
    const admittedByRedirect = await hasAdmittingRedirect(redirectTo, this.authRepository);
    const state = await this.repository.findLoginAccountState(email);

    if (!state) {
      return admittedByRedirect
        ? { admitted: true, state: null, admittedByRedirect }
        : { admitted: false, reason: 'unknown_address_without_admitting_redirect' };
    }

    // An address the account never confirmed is not turned away here: the link and the code
    // are only ever delivered to the address itself, and coming back with either is the proof
    // of ownership. Refusing at this point asked for a confirmation that could never happen,
    // because confirming an address needs a session and this is the way to one.
    return hasStandingToSignIn(state) || admittedByRedirect
      ? { admitted: true, state, admittedByRedirect }
      : { admitted: false, reason: 'no_standing_to_sign_in' };
  }

  private async hasExhaustedRequests(
    email: string,
    purpose: 'sign_in' | 'verify_email',
  ): Promise<boolean> {
    const recent = await this.repository.countRecentTokens(
      email,
      purpose,
      emailLoginRequestWindowStart(new Date()),
    );

    return recent >= EMAIL_LOGIN_REQUESTS_PER_WINDOW;
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
