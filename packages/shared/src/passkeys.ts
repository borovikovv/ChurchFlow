import { z } from 'zod';

// The WebAuthn ceremony shapes as they cross between the API and the browser. The API
// validates incoming credentials with the schemas below and the web app builds them, so both
// sides read the contract from here rather than each keeping its own copy.

export type PasskeyUserVerification = 'discouraged' | 'preferred' | 'required';
export type PasskeyAttachment = 'cross-platform' | 'platform';

export interface PasskeyCredentialDescriptorJson {
  id: string;
  type: 'public-key';
  transports?: string[];
}

export interface PasskeyRegistrationOptions {
  challenge: string;
  rp: { id?: string; name: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: Array<{ alg: number; type: 'public-key' }>;
  timeout?: number;
  attestation?: 'direct' | 'enterprise' | 'indirect' | 'none';
  excludeCredentials?: PasskeyCredentialDescriptorJson[];
  authenticatorSelection?: {
    authenticatorAttachment?: PasskeyAttachment;
    requireResidentKey?: boolean;
    residentKey?: 'discouraged' | 'preferred' | 'required';
    userVerification?: PasskeyUserVerification;
  };
}

export interface PasskeyAuthenticationOptions {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: PasskeyCredentialDescriptorJson[];
  userVerification?: PasskeyUserVerification;
}

export interface PasskeySummary {
  id: string;
  label: string | null;
  credentialId: string;
  transports: string[];
  backedUp: boolean | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export const PASSKEY_LABEL_MAX_LENGTH = 60;

const base64Url = z.string().min(1).max(4096);
const passkeyAttachmentSchema = z.enum(['cross-platform', 'platform']).optional();
const passkeyLabelSchema = z.string().trim().min(1).max(PASSKEY_LABEL_MAX_LENGTH);

export const passkeyRegistrationCredentialSchema = z.object({
  id: base64Url,
  rawId: base64Url,
  type: z.literal('public-key'),
  authenticatorAttachment: passkeyAttachmentSchema,
  response: z.object({
    clientDataJSON: base64Url,
    attestationObject: base64Url,
    transports: z.array(z.string().max(32)).max(8).optional(),
  }),
});

export const passkeyAuthenticationCredentialSchema = z.object({
  id: base64Url,
  rawId: base64Url,
  type: z.literal('public-key'),
  authenticatorAttachment: passkeyAttachmentSchema,
  response: z.object({
    clientDataJSON: base64Url,
    authenticatorData: base64Url,
    signature: base64Url,
    userHandle: base64Url.optional(),
  }),
});

export const registerPasskeySchema = z.object({
  credential: passkeyRegistrationCredentialSchema,
  label: passkeyLabelSchema.optional(),
});

export const authenticatePasskeySchema = z.object({
  credential: passkeyAuthenticationCredentialSchema,
  redirectTo: z.string().min(1).max(500).optional(),
});

export const renamePasskeySchema = z.object({ label: passkeyLabelSchema });

export type PasskeyRegistrationCredential = z.infer<typeof passkeyRegistrationCredentialSchema>;
export type PasskeyAuthenticationCredential = z.infer<typeof passkeyAuthenticationCredentialSchema>;
export type RegisterPasskeyInput = z.infer<typeof registerPasskeySchema>;
export type AuthenticatePasskeyInput = z.infer<typeof authenticatePasskeySchema>;
export type RenamePasskeyInput = z.infer<typeof renamePasskeySchema>;
