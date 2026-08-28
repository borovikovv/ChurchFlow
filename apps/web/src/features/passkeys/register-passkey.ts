import type { PasskeySummary } from '@churchflow/shared';
import { createPasskeyCredential } from '@/lib/webauthn';
import { rememberDeviceCredential } from './device-registry';
import { finishPasskeyRegistration, startPasskeyRegistration } from './server/actions';

export type PasskeyRegistrationResult =
  | { ok: true; passkey: PasskeySummary }
  | { ok: false; error: string };

// Throws whatever the WebAuthn ceremony throws, including the cancellation the browser
// reports when the prompt is dismissed. Callers decide which of those is worth reporting.
export async function registerPasskeyOnThisDevice(): Promise<PasskeyRegistrationResult> {
  const options = await startPasskeyRegistration();
  if (!options.ok) {
    return { ok: false, error: options.error };
  }

  const credential = await createPasskeyCredential(options.data);
  const label = defaultPasskeyLabel();
  const registered = await finishPasskeyRegistration({
    credential,
    ...(label ? { label } : {}),
  });
  if (!registered.ok) {
    return { ok: false, error: registered.error };
  }

  rememberDeviceCredential(registered.data.credentialId);

  return { ok: true, passkey: registered.data };
}

// A best-effort name so the list is readable before anyone renames anything. User agents are
// self-reported, so an unrecognised one simply goes unnamed.
function defaultPasskeyLabel(): string | undefined {
  const platforms = ['Mac', 'iPhone', 'iPad', 'Android', 'Windows', 'Linux'] as const;
  const userAgent = window.navigator.userAgent;

  return platforms.find((platform) => userAgent.includes(platform));
}
