import { z } from 'zod';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { PASSKEY_LABEL_MAX_LENGTH, toKnownTransports } from '../passkey-policy';

const base64Url = z.string().min(1).max(4096);
const authenticatorAttachment = z.enum(['cross-platform', 'platform']).optional();
const label = z.string().trim().min(1).max(PASSKEY_LABEL_MAX_LENGTH);

const registrationEnvelopeSchema = z.object({
  id: base64Url,
  rawId: base64Url,
  type: z.literal('public-key'),
  authenticatorAttachment,
  response: z.object({
    clientDataJSON: base64Url,
    attestationObject: base64Url,
    transports: z.array(z.string().max(32)).max(8).optional(),
  }),
});

const authenticationEnvelopeSchema = z.object({
  id: base64Url,
  rawId: base64Url,
  type: z.literal('public-key'),
  authenticatorAttachment,
  response: z.object({
    clientDataJSON: base64Url,
    authenticatorData: base64Url,
    signature: base64Url,
    userHandle: base64Url.optional(),
  }),
});

export const registerPasskeySchema = z.object({
  credential: registrationEnvelopeSchema,
  label: label.optional(),
});

export const authenticatePasskeySchema = z.object({
  credential: authenticationEnvelopeSchema,
  redirectTo: z.string().min(1).max(500).optional(),
});

export const renamePasskeySchema = z.object({ label });

type RegisterPasskeyInput = z.infer<typeof registerPasskeySchema>;
type AuthenticatePasskeyInput = z.infer<typeof authenticatePasskeySchema>;
type RenamePasskeyInput = z.infer<typeof renamePasskeySchema>;

export class RegisterPasskeyDto implements RegisterPasskeyInput {
  static readonly schema = registerPasskeySchema;

  credential!: RegisterPasskeyInput['credential'];
  label?: string;
}

export class AuthenticatePasskeyDto implements AuthenticatePasskeyInput {
  static readonly schema = authenticatePasskeySchema;

  credential!: AuthenticatePasskeyInput['credential'];
  redirectTo?: string;
}

export class RenamePasskeyDto implements RenamePasskeyInput {
  static readonly schema = renamePasskeySchema;

  label!: string;
}

// Only the fields the verifier actually reads are carried across. Extensions are never
// requested, so an empty result is the honest value rather than whatever a client sent.
export function toRegistrationResponse(
  credential: RegisterPasskeyInput['credential'],
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
  credential: AuthenticatePasskeyInput['credential'],
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
