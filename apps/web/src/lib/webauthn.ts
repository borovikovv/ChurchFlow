import type {
  PasskeyAttachment,
  PasskeyAuthenticationCredential,
  PasskeyAuthenticationOptions,
  PasskeyCredentialDescriptorJson,
  PasskeyRegistrationCredential,
  PasskeyRegistrationOptions,
} from '@churchflow/shared';

// TypeScript's DOM lib knows a narrower transport list than the spec, and authenticators
// report values neither list has heard of. Anything unusable is dropped.
const DOM_TRANSPORTS = ['ble', 'hybrid', 'internal', 'nfc', 'usb'] as const;

export function isPasskeySupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function';
}

export async function isPasskeyAutofillAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) {
    return false;
  }

  const available = window.PublicKeyCredential.isConditionalMediationAvailable;
  if (typeof available !== 'function') {
    return false;
  }

  try {
    return await available.call(window.PublicKeyCredential);
  } catch {
    return false;
  }
}

// Whether the device itself can hold a passkey: Touch ID, Windows Hello, an Android screen
// lock. A browser that supports WebAuthn on a desktop without one can still use a security
// key, but it is not somewhere to volunteer an unprompted offer.
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) {
    return false;
  }

  const available = window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable;
  if (typeof available !== 'function') {
    return false;
  }

  try {
    return await available.call(window.PublicKeyCredential);
  } catch {
    return false;
  }
}

export async function createPasskeyCredential(
  options: PasskeyRegistrationOptions,
): Promise<PasskeyRegistrationCredential> {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: base64UrlToBytes(options.challenge),
      rp: options.rp,
      user: {
        id: base64UrlToBytes(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: options.pubKeyCredParams,
      ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
      ...(options.attestation ? { attestation: options.attestation } : {}),
      ...(options.authenticatorSelection
        ? { authenticatorSelection: options.authenticatorSelection }
        : {}),
      ...(options.excludeCredentials
        ? { excludeCredentials: options.excludeCredentials.map(toDomDescriptor) }
        : {}),
    },
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('The browser did not return a passkey');
  }

  const response = credential.response;
  if (!(response instanceof AuthenticatorAttestationResponse)) {
    throw new Error('The browser did not return a passkey');
  }

  const attachment = toAttachment(credential.authenticatorAttachment);

  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: 'public-key',
    ...(attachment ? { authenticatorAttachment: attachment } : {}),
    response: {
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      attestationObject: bytesToBase64Url(response.attestationObject),
      ...(typeof response.getTransports === 'function'
        ? { transports: response.getTransports() }
        : {}),
    },
  };
}

export async function requestPasskeyCredential(
  options: PasskeyAuthenticationOptions,
  init: { conditional?: boolean; signal?: AbortSignal } = {},
): Promise<PasskeyAuthenticationCredential> {
  const credential = await navigator.credentials.get({
    ...(init.conditional ? { mediation: 'conditional' } : {}),
    ...(init.signal ? { signal: init.signal } : {}),
    publicKey: {
      challenge: base64UrlToBytes(options.challenge),
      ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
      ...(options.rpId ? { rpId: options.rpId } : {}),
      ...(options.userVerification ? { userVerification: options.userVerification } : {}),
      ...(options.allowCredentials
        ? { allowCredentials: options.allowCredentials.map(toDomDescriptor) }
        : {}),
    },
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('The browser did not return a passkey');
  }

  const response = credential.response;
  if (!(response instanceof AuthenticatorAssertionResponse)) {
    throw new Error('The browser did not return a passkey');
  }

  const attachment = toAttachment(credential.authenticatorAttachment);

  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: 'public-key',
    ...(attachment ? { authenticatorAttachment: attachment } : {}),
    response: {
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      authenticatorData: bytesToBase64Url(response.authenticatorData),
      signature: bytesToBase64Url(response.signature),
      ...(response.userHandle ? { userHandle: bytesToBase64Url(response.userHandle) } : {}),
    },
  };
}

// A cancelled ceremony is the user closing the prompt, not a failure worth reporting.
export function isAbortedPasskeyCeremony(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'NotAllowedError')
  );
}

// The registration ceremony excludes credentials the account already holds, and an
// authenticator asked to duplicate one refuses instead of prompting. That is an answer about
// this device, not a failure.
export function isExistingPasskeyCeremony(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'InvalidStateError';
}

function toDomDescriptor(
  descriptor: PasskeyCredentialDescriptorJson,
): PublicKeyCredentialDescriptor {
  const transports = descriptor.transports?.filter(
    (transport): transport is AuthenticatorTransport =>
      DOM_TRANSPORTS.some((known) => known === transport),
  );

  return {
    id: base64UrlToBytes(descriptor.id),
    type: descriptor.type,
    ...(transports && transports.length > 0 ? { transports } : {}),
  };
}

function toAttachment(value: string | null): PasskeyAttachment | undefined {
  return value === 'platform' || value === 'cross-platform' ? value : undefined;
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64Url(value: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(value)) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
