export const PASSKEY_CHALLENGE_TTL_SECONDS = 3 * 60;

const AUTHENTICATOR_TRANSPORTS = [
  'ble',
  'cable',
  'hybrid',
  'internal',
  'nfc',
  'smart-card',
  'usb',
] as const;

export type AuthenticatorTransport = (typeof AUTHENTICATOR_TRANSPORTS)[number];

// Transports are stored as plain strings because authenticators may report values this
// build has never heard of. Anything unrecognised is dropped rather than trusted.
export function toKnownTransports(values: readonly string[]): AuthenticatorTransport[] {
  return values.filter((value): value is AuthenticatorTransport =>
    AUTHENTICATOR_TRANSPORTS.some((transport) => transport === value),
  );
}

export function passkeyChallengeExpiresAt(now: Date): Date {
  return new Date(now.getTime() + PASSKEY_CHALLENGE_TTL_SECONDS * 1000);
}

// An authenticator that keeps a counter must always move it forward; standing still or going
// backwards is how a cloned credential shows up. Most passkeys never count at all and report
// zero forever, so the check only applies once a credential has proved it counts.
export function isReplayedSignCount(storedCount: number, presentedCount: number): boolean {
  return storedCount > 0 && presentedCount <= storedCount;
}
