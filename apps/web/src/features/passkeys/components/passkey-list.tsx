'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import type { PasskeySummary } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { isAbortedPasskeyCeremony, isPasskeySupported } from '@/lib/webauthn';
import { registerPasskeyOnThisDevice } from '../register-passkey';
import { removePasskey, renamePasskey } from '../server/actions';
import { PasskeyRow } from './passkey-row';

export function PasskeyList({ passkeys, locale }: { passkeys: PasskeySummary[]; locale: string }) {
  const t = useTranslations('passkeys');
  const router = useRouter();
  const [supported, setSupported] = useState(true);
  const [adding, setAdding] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Passkey support is a property of the browser, so it can only be read once one is running.
  useEffect(() => {
    setSupported(isPasskeySupported());
  }, []);

  async function handleAdd(): Promise<void> {
    setAdding(true);
    try {
      const registered = await registerPasskeyOnThisDevice();
      if (!registered.ok) {
        toast.error(registered.error);
        return;
      }

      toast.success(t('added'));
      router.refresh();
    } catch (caught) {
      if (!isAbortedPasskeyCeremony(caught)) {
        toast.error(t('failed'));
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRename(passkeyId: string, label: string): Promise<boolean> {
    setPendingId(passkeyId);
    try {
      const result = await renamePasskey(passkeyId, label);
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }

      toast.success(t('renamed'));
      router.refresh();
      return true;
    } finally {
      setPendingId(null);
    }
  }

  async function handleRemove(passkeyId: string): Promise<boolean> {
    setPendingId(passkeyId);
    try {
      const result = await removePasskey(passkeyId);
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }

      toast.success(t('removed'));
      router.refresh();
      return true;
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="stack">
      {passkeys.length === 0 ? (
        <p className="text-sm opacity-70">{t('empty')}</p>
      ) : (
        <ul className="stack list-none p-0">
          {passkeys.map((passkey) => (
            <PasskeyRow
              busy={pendingId === passkey.id || adding}
              key={passkey.id}
              locale={locale}
              onRemove={() => handleRemove(passkey.id)}
              onRename={(label) => handleRename(passkey.id, label)}
              passkey={passkey}
            />
          ))}
        </ul>
      )}

      {supported ? (
        <div>
          <Button disabled={adding} onClick={() => void handleAdd()} type="button">
            {adding ? t('adding') : t('addPasskey')}
          </Button>
        </div>
      ) : (
        <p className="form-error">{t('unsupported')}</p>
      )}
    </div>
  );
}
