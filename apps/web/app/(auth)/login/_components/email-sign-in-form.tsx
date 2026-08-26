'use client';

import { useState, type FormEvent } from 'react';
import { postToApi } from '@/api/browser-client';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/forms/form-field';

export interface EmailSignInMessages {
  emailAddress: string;
  continueWithEmail: string;
  checkYourEmail: string;
  emailSignInSent: string;
  signInCode: string;
  confirmCode: string;
  useAnotherEmail: string;
  signInFailed: string;
}

export function EmailSignInForm({
  redirectTo,
  messages,
}: {
  redirectTo?: string | undefined;
  messages: EmailSignInMessages;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestSignIn(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await postToApi<{ ok: true }>(
      '/auth/email/request',
      { email, ...(redirectTo ? { redirectTo } : {}) },
      messages.signInFailed,
    );
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setCodeRequested(true);
  }

  async function submitCode(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await postToApi<{ redirectTo: string }>(
      '/auth/email/code',
      { email, code },
      messages.signInFailed,
    );

    if (!result.ok) {
      setPending(false);
      setError(result.message);
      return;
    }

    // A full navigation, so the middleware sees the session cookie the API just set.
    window.location.assign(result.data.redirectTo);
  }

  if (codeRequested) {
    return (
      <form className="auth-sign-in-form grid gap-3" onSubmit={submitCode}>
        <p className="font-semibold">{messages.checkYourEmail}</p>
        <p className="text-sm text-[var(--muted)]">{messages.emailSignInSent}</p>
        <FormField label={messages.signInCode}>
          {({ id }) => (
            <input
              id={id}
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value)}
              pattern="\d{6}"
              required
              value={code}
            />
          )}
        </FormField>
        {error ? <p className="form-error">{error}</p> : null}
        <Button disabled={pending} type="submit">
          {messages.confirmCode}
        </Button>
        <Button
          onClick={() => {
            setCodeRequested(false);
            setCode('');
            setError(null);
          }}
          type="button"
          variant="ghost"
        >
          {messages.useAnotherEmail}
        </Button>
      </form>
    );
  }

  return (
    <form className="auth-sign-in-form grid gap-3" onSubmit={requestSignIn}>
      <FormField label={messages.emailAddress}>
        {({ id }) => (
          <input
            id={id}
            // The `webauthn` token is what lets the browser offer saved passkeys in this
            // field while the conditional ceremony is waiting.
            autoComplete="username webauthn"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        )}
      </FormField>
      {error ? <p className="form-error">{error}</p> : null}
      <Button disabled={pending} type="submit">
        {messages.continueWithEmail}
      </Button>
    </form>
  );
}
