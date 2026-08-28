import {
  authenticatePasskeySchema,
  registerPasskeySchema,
  renamePasskeySchema,
  type AuthenticatePasskeyInput,
  type PasskeyAuthenticationCredential,
  type PasskeyRegistrationCredential,
  type RegisterPasskeyInput,
  type RenamePasskeyInput,
} from '@churchflow/shared';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { toKnownTransports } from '../passkey-policy';

export class RegisterPasskeyDto implements RegisterPasskeyInput {
  static readonly schema = registerPasskeySchema;

  credential!: PasskeyRegistrationCredential;
  label?: string;
}

export class AuthenticatePasskeyDto implements AuthenticatePasskeyInput {
  static readonly schema = authenticatePasskeySchema;

  credential!: PasskeyAuthenticationCredential;
  redirectTo?: string;
}

export class RenamePasskeyDto implements RenamePasskeyInput {
  static readonly schema = renamePasskeySchema;

  label!: string;
}

// Only the fields the verifier actually reads are carried across. Extensions are never
// requested, so an empty result is the honest value rather than whatever a client sent.
export function toRegistrationResponse(
  credential: PasskeyRegistrationCredential,
): RegistrationResponseJSON {
  return {
    id: credential.id,
    rawId: credential.rawId,
    type: credential.type,
    clientExtensionResults: {},
    ...(credential.authenticatorAttachment
      ? { authenticatorAttachment: credential.authenticatorAttachment }
      : {}),
    response: {
      clientDataJSON: credential.response.clientDataJSON,
      attestationObject: credential.response.attestationObject,
      ...(credential.response.transports
        ? { transports: toKnownTransports(credential.response.transports) }
        : {}),
    },
  };
}

export function toAuthenticationResponse(
  credential: PasskeyAuthenticationCredential,
): AuthenticationResponseJSON {
  return {
    id: credential.id,
    rawId: credential.rawId,
    type: credential.type,
    clientExtensionResults: {},
    ...(credential.authenticatorAttachment
      ? { authenticatorAttachment: credential.authenticatorAttachment }
      : {}),
    response: {
      clientDataJSON: credential.response.clientDataJSON,
      authenticatorData: credential.response.authenticatorData,
      signature: credential.response.signature,
      ...(credential.response.userHandle ? { userHandle: credential.response.userHandle } : {}),
    },
  };
}
