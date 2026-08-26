'use client';

import { useEffect, useRef, useState } from 'react';
import { postToApi } from '@/api/browser-client';
import { Button } from '@/components/ui/button';
import type { PasskeyAuthenticationOptions } from '@churchflow/shared';
import {
  isAbortedPasskeyCeremony,
  isPasskeyAutofillAvailable,
  isPasskeySupported,
  requestPasskeyCredential,
} from '@/lib/webauthn';

export interface PasskeySignInMessages {
  signInWithPasskey: string;
  passkeySignInFailed: string;
}

export function PasskeySignIn({
  redirectTo,
  messages,
}: {
  redirectTo?: string | undefined;
  messages: PasskeySignInMessages;
}) {
  const [supported, setSupported] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autofillRef = useRef<AbortController | null>(null);

  // Whether this browser can do WebAuthn at all is only knowable once it is running, so the
  // button stays hidden until the check has happened rather than offering a dead control.
  useEffect(() => {
    setSupported(isPasskeySupported());
  }, []);

  // Conditional mediation is a browser-owned prompt that lives for as long as the page does:
  // it waits in the background and surfaces saved passkeys inside the email field. Aborting
  // it on unmount is the cleanup.
  useEffect(() => {
    const controller = new AbortController();
    autofillRef.current = controller;
    let cancelled = false;

    async function offerAutofill(): Promise<void> {
      if (!(await isPasskeyAutofillAvailable()) || cancelled) {
        return;
      }

      try {
        await signIn({ conditional: true, signal: controller.signal, redirectTo });
      } catch (caught) {
        if (!cancelled && !isAbortedPasskeyCeremony(caught)) {
          setError(messages.passkeySignInFailed);
        }
      }
    }

    void offerAutofill();

    return () => {
      cancelled = true;
      autofillRef.current = null;
      controller.abort();
    };
  }, [redirectTo, messages.passkeySignInFailed]);

  async function signInOnDemand(): Promise<void> {
    // A conditional ceremony already waiting in the background would make this second
    // request a concurrent one, which the browser refuses outright.
    autofillRef.current?.abort();
    autofillRef.current = null;
    setPending(true);
    setError(null);

    try {
      await signIn({ redirectTo });
    } catch (caught) {
      if (!isAbortedPasskeyCeremony(caught)) {
        setError(messages.passkeySignInFailed);
      }
    } finally {
      setPending(false);
    }
  }

  if (!supported) {
    return null;
  }

  return (
    <div className="auth-sign-in-form grid gap-2">
      <Button disabled={pending} onClick={signInOnDemand} type="button" variant="secondary">
        {messages.signInWithPasskey}
      </Button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

async function signIn(init: {
  redirectTo?: string | undefined;
  conditional?: boolean;
  signal?: AbortSignal;
}): Promise<void> {
  const options = await postToApi<PasskeyAuthenticationOptions>(
    '/auth/passkeys/login/options',
    {},
    'Passkey sign-in is unavailable',
  );
  if (!options.ok) {
    throw new Error(options.message);
  }

  const credential = await requestPasskeyCredential(options.data, {
    ...(init.conditional ? { conditional: true } : {}),
    ...(init.signal ? { signal: init.signal } : {}),
  });

  const verified = await postToApi<{ redirectTo: string }>(
    '/auth/passkeys/login/verify',
    { credential, ...(init.redirectTo ? { redirectTo: init.redirectTo } : {}) },
    'Passkey sign-in is unavailable',
  );
  if (!verified.ok) {
    throw new Error(verified.message);
  }

  // A full navigation, so the middleware sees the session cookie the API just set.
  window.location.assign(verified.data.redirectTo);
}
