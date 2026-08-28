'use client';

import { useCallback, useEffect, useState } from 'react';
import { isPlatformAuthenticatorAvailable } from '@/lib/webauthn';
import {
  dismissPasskeyPrompt,
  hasDeviceCredential,
  isPasskeyPromptDismissed,
  markPasskeyPromptChecked,
  wasPasskeyPromptCheckedThisSession,
} from '../device-registry';
import { getPasskeys } from '../server/actions';

export interface PasskeyPromptState {
  offered: boolean;
  dismiss: () => void;
  hide: () => void;
}

export function usePasskeyPrompt(): PasskeyPromptState {
  const [offered, setOffered] = useState(false);

  // Every input to this decision lives outside React and only the browser can answer it: web
  // storage, the platform authenticator, and the passkeys the account already holds.
  useEffect(() => {
    let cancelled = false;

    async function evaluate(): Promise<void> {
      if (isPasskeyPromptDismissed() || wasPasskeyPromptCheckedThisSession()) {
        return;
      }

      if (!(await isPlatformAuthenticatorAvailable())) {
        if (!cancelled) {
          markPasskeyPromptChecked();
        }

        return;
      }

      const result = await getPasskeys();
      if (cancelled) {
        return;
      }

      // Nobody asked for this offer, so failing to build it is not worth an error banner.
      // Leaving the session unmarked lets the next page load try again.
      if (!result.ok) {
        return;
      }

      markPasskeyPromptChecked();

      if (hasDeviceCredential(result.data.map((passkey) => passkey.credentialId))) {
        return;
      }

      setOffered(true);
    }

    void evaluate();

    return () => {
      cancelled = true;
    };
  }, []);

  const hide = useCallback(() => setOffered(false), []);

  const dismiss = useCallback(() => {
    dismissPasskeyPrompt();
    setOffered(false);
  }, []);

  return { offered, dismiss, hide };
}
