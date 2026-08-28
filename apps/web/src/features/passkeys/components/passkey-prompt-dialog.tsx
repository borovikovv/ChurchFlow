'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { isAbortedPasskeyCeremony, isExistingPasskeyCeremony } from '@/lib/webauthn';
import { usePasskeyPrompt } from '../hooks/use-passkey-prompt';
import { registerPasskeyOnThisDevice } from '../register-passkey';

export function PasskeyPromptDialog() {
  const t = useTranslations('passkeys');
  const { offered, dismiss, hide } = usePasskeyPrompt();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);

  // A <dialog> only becomes modal through an imperative browser call, and this one has no
  // trigger to make it from: the offer appears once the checks behind it have finished.
  useEffect(() => {
    if (offered) {
      dialogRef.current?.showModal();
    }
  }, [offered]);

  if (!offered) {
    return null;
  }

  async function connect(): Promise<void> {
    setPending(true);

    try {
      const result = await registerPasskeyOnThisDevice();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(t('added'));
      dialogRef.current?.close();
    } catch (caught) {
      // The device turns out to hold a passkey this browser had no note of. Which one it is
      // stays unknown, so the offer is retired the same way declining it would retire it.
      if (isExistingPasskeyCeremony(caught)) {
        toast.info(t('alreadyOnDevice'));
        dialogRef.current?.close();
        dismiss();
        return;
      }

      // A cancelled ceremony leaves the offer standing, so it can be tried again.
      if (!isAbortedPasskeyCeremony(caught)) {
        toast.error(t('failed'));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog
      dialogRef={dialogRef}
      footer={
        <>
          <Button
            disabled={pending}
            onClick={() => {
              dialogRef.current?.close();
              dismiss();
            }}
            type="button"
            variant="secondary"
          >
            {t('promptDismiss')}
          </Button>
          <Button disabled={pending} onClick={() => void connect()} type="button">
            {pending ? t('adding') : t('addPasskey')}
          </Button>
        </>
      }
      onClose={hide}
      title={t('promptTitle')}
    >
      <p className="m-0">{t('promptDescription')}</p>
    </FormDialog>
  );
}
