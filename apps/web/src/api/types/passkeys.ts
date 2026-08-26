// Wire shapes for the WebAuthn ceremonies. The API validates these with zod in
// apps/api/src/modules/auth/passkeys/dto/passkey.dto.ts, which stays the authority.

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

export interface PasskeyRegistrationCredential {
  id: string;
  rawId: string;
  type: 'public-key';
  authenticatorAttachment?: PasskeyAttachment;
  response: {
    clientDataJSON: string;
    attestationObject: string;
    transports?: string[];
  };
}

export interface PasskeyAuthenticationCredential {
  id: string;
  rawId: string;
  type: 'public-key';
  authenticatorAttachment?: PasskeyAttachment;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
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
