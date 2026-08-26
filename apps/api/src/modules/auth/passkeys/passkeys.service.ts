import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@churchflow/db';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { requestClientContext } from '../../../common/auth/request-client-context';
import { normalizeInternalRedirect } from '../../../common/auth/internal-redirect';
import { hashOpaqueToken } from '../../../common/auth/session-token';
import { AuditService } from '../../audit/audit.service';
import { AuthService } from '../auth.service';
import { hasStandingToSignIn, resolveLoginRedirect } from '../login-state';
import {
  isReplayedSignCount,
  passkeyChallengeExpiresAt,
  toKnownTransports,
} from './passkey-policy';
import { PasskeysRepository, type PasskeyRecord } from './passkeys.repository';

export type PasskeyClientContext = ReturnType<typeof requestClientContext>;

export interface PasskeySignInResult {
  sessionToken: string;
  sessionExpiresAt: Date;
  redirectTo: string;
}

@Injectable()
export class PasskeysService {
  private readonly logger = new Logger(PasskeysService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly repository: PasskeysRepository,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  list(userId: string): Promise<PasskeyRecord[]> {
    return this.repository.listForUser(userId);
  }

  async startRegistration(userId: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const state = await this.repository.findLoginState(userId);
    if (!state) {
      throw new NotFoundException('User was not found');
    }

    const existing = await this.repository.listCredentialsForUser(userId);
    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpId,
      userID: new TextEncoder().encode(state.user.id),
      userName: state.user.email ?? state.user.displayName ?? state.user.id,
      userDisplayName: state.user.displayName ?? state.user.email ?? 'ChurchFlow',
      attestationType: 'none',
      excludeCredentials: existing.map((credential) => ({
        id: credential.credentialId,
        transports: toKnownTransports(credential.transports),
      })),
      // Discoverable credentials are what let the sign-in page offer one button instead of
      // asking who is signing in first.
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });

    await this.repository.createChallenge({
      challengeHash: hashOpaqueToken(options.challenge),
      type: 'registration',
      expiresAt: passkeyChallengeExpiresAt(new Date()),
      userId,
    });

    return options;
  }

  async finishRegistration(
    userId: string,
    response: RegistrationResponseJSON,
    label?: string,
  ): Promise<PasskeyRecord> {
    const verification = await this.verified(() =>
      verifyRegistrationResponse({
        response,
        expectedChallenge: (challenge) =>
          this.repository.consumeChallenge(hashOpaqueToken(challenge), 'registration', userId),
        expectedOrigin: this.expectedOrigins,
        expectedRPID: this.rpId,
        // User verification is requested but not demanded, so requiring it here would reject
        // the authenticators the request deliberately allowed.
        requireUserVerification: false,
      }),
    );

    if (!verification.verified) {
      throw new UnauthorizedException('This passkey could not be verified');
    }

    const { credential, aaguid, credentialBackedUp } = verification.registrationInfo;

    try {
      const passkey = await this.repository.createPasskey({
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        signCount: credential.counter,
        transports: credential.transports ?? [],
        aaguid,
        backedUp: credentialBackedUp,
        ...(label ? { label } : {}),
      });

      await this.auditService.record({
        actorUserId: userId,
        action: 'CREATE',
        entityType: 'User',
        entityId: userId,
        metadata: { event: 'passkey_registered' },
      });

      return passkey;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This passkey is already registered');
      }

      throw error;
    }
  }

  async rename(userId: string, passkeyId: string, label: string): Promise<PasskeyRecord> {
    const passkey = await this.repository.rename(passkeyId, userId, label);
    if (!passkey) {
      throw new NotFoundException('Passkey was not found');
    }

    return passkey;
  }

  async remove(userId: string, passkeyId: string): Promise<{ ok: true }> {
    // Removing the only way back in would lock the account out of itself.
    if ((await this.repository.countSignInMethods(userId)) <= 1) {
      throw new ConflictException('Add another sign-in method before removing the last one');
    }

    if (!(await this.repository.deletePasskey(passkeyId, userId))) {
      throw new NotFoundException('Passkey was not found');
    }

    await this.auditService.record({
      actorUserId: userId,
      action: 'DELETE',
      entityType: 'User',
      entityId: userId,
      metadata: { event: 'passkey_removed' },
    });

    return { ok: true };
  }

  async startAuthentication(): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      userVerification: 'preferred',
    });

    await this.repository.createChallenge({
      challengeHash: hashOpaqueToken(options.challenge),
      type: 'authentication',
      expiresAt: passkeyChallengeExpiresAt(new Date()),
    });

    return options;
  }

  async finishAuthentication(input: {
    response: AuthenticationResponseJSON;
    redirectTo?: string;
    client: PasskeyClientContext;
  }): Promise<PasskeySignInResult> {
    const credential = await this.repository.findCredential(input.response.id);
    if (!credential) {
      throw new UnauthorizedException('This passkey could not be verified');
    }

    const verification = await this.verified(() =>
      verifyAuthenticationResponse({
        response: input.response,
        expectedChallenge: (challenge) =>
          this.repository.consumeChallenge(hashOpaqueToken(challenge), 'authentication'),
        expectedOrigin: this.expectedOrigins,
        expectedRPID: this.rpId,
        requireUserVerification: false,
        credential: {
          id: credential.credentialId,
          publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64url')),
          counter: credential.signCount,
          transports: toKnownTransports(credential.transports),
        },
      }),
    );

    if (!verification.verified) {
      throw new UnauthorizedException('This passkey could not be verified');
    }

    const { newCounter, credentialBackedUp } = verification.authenticationInfo;
    if (isReplayedSignCount(credential.signCount, newCounter)) {
      throw new UnauthorizedException('This passkey could not be verified');
    }

    const state = await this.repository.findLoginState(credential.userId);
    if (!state || !hasStandingToSignIn(state)) {
      throw new UnauthorizedException('This account cannot sign in');
    }

    await this.repository.recordAuthentication(credential.id, newCounter, credentialBackedUp);
    const session = await this.authService.createUserSession(credential.userId, input.client);

    await this.auditService.record({
      actorUserId: credential.userId,
      action: 'LOGIN',
      entityType: 'User',
      entityId: credential.userId,
      metadata: { provider: 'passkey' },
    });

    return {
      ...session,
      redirectTo: resolveLoginRedirect(
        state,
        normalizeInternalRedirect(input.redirectTo, this.webAppUrl) ?? null,
      ),
    };
  }

  // A rejected challenge, a malformed attestation or a bad signature all surface from the
  // verifier as a plain Error. None of them is a server fault, so none should read as one.
  private async verified<T>(verify: () => Promise<T>): Promise<T> {
    try {
      return await verify();
    } catch (error: unknown) {
      this.logger.warn({
        event: 'WebAuthn verification failed',
        reason: error instanceof Error ? error.message : 'unknown',
      });

      throw new UnauthorizedException('This passkey could not be verified');
    }
  }

  // Relying party identity defaults to the web app's own host so local and preview
  // deployments work without extra configuration.
  private get rpId(): string {
    return this.config.get<string>('WEBAUTHN_RP_ID')?.trim() || new URL(this.webAppUrl).hostname;
  }

  private get rpName(): string {
    return this.config.get<string>('WEBAUTHN_RP_NAME')?.trim() || 'ChurchFlow';
  }

  private get expectedOrigins(): string[] {
    const configured = this.config.get<string>('WEBAUTHN_ORIGINS')?.trim();
    if (!configured) {
      return [new URL(this.webAppUrl).origin];
    }

    return configured
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  private get webAppUrl(): string {
    return this.config.getOrThrow<string>('WEB_APP_URL');
  }
}
