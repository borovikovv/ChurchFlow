'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import type { PasskeySummary } from '@/api/types/passkeys';
import {
  createPasskeyCredential,
  isAbortedPasskeyCeremony,
  isPasskeySupported,
} from '@/lib/webauthn';
import {
  finishPasskeyRegistration,
  removePasskey,
  renamePasskey,
  startPasskeyRegistration,
} from '../server/actions';
import { formatPasskeyLastUsed } from '../format-last-used';

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
      const options = await startPasskeyRegistration();
      if (!options.ok) {
        toast.error(options.error);
        return;
      }

      const credential = await createPasskeyCredential(options.data);
      const label = defaultPasskeyLabel();
      const registered = await finishPasskeyRegistration({
        credential,
        ...(label ? { label } : {}),
      });
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

  async function handleRename(passkey: PasskeySummary): Promise<void> {
    const label = window.prompt(t('label'), passkey.label ?? '')?.trim();
    if (!label) {
      return;
    }

    setPendingId(passkey.id);
    try {
      const result = await renamePasskey(passkey.id, label);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(t('renamed'));
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function handleRemove(passkeyId: string): Promise<void> {
    setPendingId(passkeyId);
    try {
      const result = await removePasskey(passkeyId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(t('removed'));
      router.refresh();
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
            <li
              key={passkey.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
            >
              <div className="stack gap-1">
                <span className="font-medium">{passkey.label ?? t('unnamed')}</span>
                <span className="text-sm opacity-70">
                  {formatPasskeyLastUsed(passkey.lastUsedAt, locale, {
                    never: t('neverUsed'),
                    lastUsed: (value) => t('lastUsed', { value }),
                  })}
                  {passkey.backedUp ? ` · ${t('syncedAcrossDevices')}` : ''}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={pendingId === passkey.id || adding}
                  onClick={() => void handleRename(passkey)}
                  type="button"
                  variant="secondary"
                >
                  {t('rename')}
                </Button>
                <Button
                  disabled={pendingId === passkey.id || adding}
                  onClick={() => void handleRemove(passkey.id)}
                  type="button"
                  variant="danger"
                >
                  {pendingId === passkey.id ? t('removing') : t('remove')}
                </Button>
              </div>
            </li>
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

// A best-effort name so the list is readable before anyone renames anything. User agents are
// self-reported, so an unrecognised one simply goes unnamed.
function defaultPasskeyLabel(): string | undefined {
  const platforms = [
    ['Mac', 'Mac'],
    ['iPhone', 'iPhone'],
    ['iPad', 'iPad'],
    ['Android', 'Android'],
    ['Windows', 'Windows'],
    ['Linux', 'Linux'],
  ] as const;
  const userAgent = window.navigator.userAgent;
  const match = platforms.find(([needle]) => userAgent.includes(needle));

  return match ? match[1] : undefined;
}
