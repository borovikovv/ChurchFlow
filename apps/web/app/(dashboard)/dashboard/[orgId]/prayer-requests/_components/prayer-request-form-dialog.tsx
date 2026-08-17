'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import type { CreatePrayerRequestInput, PrayerRequestItem } from '@churchflow/shared';
import { createPrayerRequestSchema } from '@churchflow/shared';
import { FormInput } from '@/components/forms/form-input';
import { FormTextarea } from '@/components/forms/form-textarea';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';

export function PrayerRequestFormDialog({
  initialRequest,
  submitLabel,
  title,
  triggerClassName,
  triggerLabel,
  onSubmit,
}: {
  initialRequest?: PrayerRequestItem;
  submitLabel: string;
  title: string;
  triggerClassName?: string;
  triggerLabel: string;
  onSubmit: (request: CreatePrayerRequestInput, closeDialog: () => void) => void;
}) {
  const t = useTranslations('prayerRequests');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = `prayer-request-form-${initialRequest?.id ?? 'new'}`;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePrayerRequestInput>({
    resolver: zodResolver(createPrayerRequestSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      title: initialRequest?.title ?? '',
      description: initialRequest?.description ?? '',
    },
  });

  const resetForm = () => {
    reset({
      title: initialRequest?.title ?? '',
      description: initialRequest?.description ?? '',
    });
  };

  const submit = handleSubmit((request) => {
    onSubmit(request, () => dialogRef.current?.close());
  });

  return (
    <FormDialog
      dialogRef={dialogRef}
      title={title}
      triggerLabel={triggerLabel}
      triggerVariant={initialRequest ? 'ghost' : 'primary'}
      onOpen={resetForm}
      {...(triggerClassName ? { triggerClassName } : {})}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form className="stack" id={formId} onSubmit={submit} noValidate>
        <FormInput
          label={t('titleLabel')}
          error={errors.title?.message}
          maxLength={160}
          minLength={2}
          {...register('title')}
        />
        <FormTextarea
          label={t('descriptionLabel')}
          error={errors.description?.message}
          maxLength={5000}
          minLength={2}
          rows={8}
          {...register('description')}
        />
      </form>
    </FormDialog>
  );
}
