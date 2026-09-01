import { readStoredJson, writeStoredJson, type StorageKind } from '@/lib/browser-storage';

// WebAuthn has no silent way to ask whether this device already holds a passkey for the
// account: every real answer costs a system prompt. So the browser keeps its own note of the
// credentials it has created or signed in with, and the account's server-side list decides
// which of those notes are still true.

const DEVICE_CREDENTIALS_KEY = 'churchflow.passkeys.deviceCredentialIds';
const PROMPT_DISMISSED_KEY = 'churchflow.passkeys.promptDismissed';
const PROMPT_CHECKED_KEY = 'churchflow.passkeys.promptChecked';

// One person can sign in to several accounts from the same browser, and each of those may
// hold more than one passkey. Old entries are dropped rather than kept forever.
const REMEMBERED_CREDENTIALS_LIMIT = 20;

export function rememberDeviceCredential(credentialId: string): void {
  const known = readDeviceCredentials().filter((id) => id !== credentialId);

  writeStoredJson(
    'local',
    DEVICE_CREDENTIALS_KEY,
    [credentialId, ...known].slice(0, REMEMBERED_CREDENTIALS_LIMIT),
  );
}

export function hasDeviceCredential(accountCredentialIds: string[]): boolean {
  const known = new Set(readDeviceCredentials());

  return accountCredentialIds.some((credentialId) => known.has(credentialId));
}

export function isPasskeyPromptDismissed(): boolean {
  return readStoredBoolean('local', PROMPT_DISMISSED_KEY);
}

export function dismissPasskeyPrompt(): void {
  writeStoredJson('local', PROMPT_DISMISSED_KEY, true);
}

// The offer belongs to signing in, not to every page load, and the answer cannot change
// while the tab lives. One conclusive check per browser session is enough.
export function wasPasskeyPromptCheckedThisSession(): boolean {
  return readStoredBoolean('session', PROMPT_CHECKED_KEY);
}

export function markPasskeyPromptChecked(): void {
  writeStoredJson('session', PROMPT_CHECKED_KEY, true);
}

function readDeviceCredentials(): string[] {
  return (
    readStoredJson('local', DEVICE_CREDENTIALS_KEY, (value) =>
      Array.isArray(value) && value.every((entry) => typeof entry === 'string')
        ? (value as string[])
        : null,
    ) ?? []
  );
}

function readStoredBoolean(kind: StorageKind, key: string): boolean {
  return readStoredJson(kind, key, (value) => (value === true ? true : null)) === true;
}
