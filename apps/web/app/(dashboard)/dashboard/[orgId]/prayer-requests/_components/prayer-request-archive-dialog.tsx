'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import type { ArchivePrayerRequestInput, PrayerRequestItem } from '@churchflow/shared';
import { archivePrayerRequestSchema } from '@churchflow/shared';
import { FormTextarea } from '@/components/forms/form-textarea';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { tableRowActionClassNameFor } from '@/components/ui/table-row-actions';

export function PrayerRequestArchiveDialog({
  disabled,
  request,
  onArchive,
}: {
  disabled: boolean;
  request: PrayerRequestItem;
  onArchive: (requestId: string, request: ArchivePrayerRequestInput) => void;
}) {
  const t = useTranslations('prayerRequests');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = `archive-prayer-request-${request.id}`;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ArchivePrayerRequestInput>({
    resolver: zodResolver(archivePrayerRequestSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      archiveReason: request.archiveReason ?? '',
    },
  });

  const resetForm = () => {
    reset({
      archiveReason: request.archiveReason ?? '',
    });
  };

  const closeDialog = () => dialogRef.current?.close();
  const submit = handleSubmit((archiveRequest) => {
    onArchive(request.id, archiveRequest);
    closeDialog();
  });

  return (
    <FormDialog
      dialogRef={dialogRef}
      title={t('archiveTitle')}
      triggerClassName={tableRowActionClassNameFor()}
      triggerDisabled={disabled}
      triggerLabel={t('archive')}
      triggerVariant="ghost"
      onOpen={resetForm}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={closeDialog}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={disabled || isSubmitting}>
            {isSubmitting ? t('archiving') : t('archiveSubmit')}
          </Button>
        </div>
      }
    >
      <form className="stack" id={formId} onSubmit={submit} noValidate>
        <p className="text-sm text-[var(--muted)]">{t('archiveDescription')}</p>
        <FormTextarea
          label={t('archiveReasonLabel')}
          error={errors.archiveReason?.message}
          maxLength={1000}
          rows={6}
          placeholder={t('archiveReasonPlaceholder')}
          {...register('archiveReason')}
        />
      </form>
    </FormDialog>
  );
}
