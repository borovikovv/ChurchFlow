'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PASSKEY_LABEL_MAX_LENGTH, type PasskeySummary } from '@churchflow/shared';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/forms/form-field';
import { FormDialog } from '@/components/ui/form-dialog';
import { formatPasskeyLastUsed } from '../format-last-used';

export function PasskeyRow({
  passkey,
  locale,
  busy,
  onRename,
  onRemove,
}: {
  passkey: PasskeySummary;
  locale: string;
  busy: boolean;
  onRename: (label: string) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
}) {
  const t = useTranslations('passkeys');
  const commonT = useTranslations('common');
  const renameRef = useRef<HTMLDialogElement>(null);
  const removeRef = useRef<HTMLDialogElement>(null);
  const [label, setLabel] = useState(passkey.label ?? '');

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b py-3">
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
        <FormDialog
          dialogRef={renameRef}
          footer={
            <Button
              disabled={busy || label.trim().length === 0}
              onClick={() => {
                void onRename(label.trim()).then((done) => {
                  if (done) renameRef.current?.close();
                });
              }}
              type="button"
            >
              {busy ? commonT('saving') : commonT('save')}
            </Button>
          }
          title={t('renameTitle')}
          triggerDisabled={busy}
          triggerLabel={t('rename')}
          onOpen={() => setLabel(passkey.label ?? '')}
        >
          <FormField label={t('label')}>
            {({ id }) => (
              <input
                id={id}
                maxLength={PASSKEY_LABEL_MAX_LENGTH}
                onChange={(event) => setLabel(event.target.value)}
                value={label}
              />
            )}
          </FormField>
        </FormDialog>
        <FormDialog
          dialogRef={removeRef}
          footer={
            <Button
              disabled={busy}
              onClick={() => {
                void onRemove().then((done) => {
                  if (done) removeRef.current?.close();
                });
              }}
              type="button"
              variant="danger"
            >
              {busy ? t('removing') : t('remove')}
            </Button>
          }
          title={t('removeTitle')}
          triggerDisabled={busy}
          triggerLabel={t('remove')}
          triggerVariant="danger"
        >
          <p className="m-0">{t('removeDescription')}</p>
        </FormDialog>
      </div>
    </li>
  );
}
