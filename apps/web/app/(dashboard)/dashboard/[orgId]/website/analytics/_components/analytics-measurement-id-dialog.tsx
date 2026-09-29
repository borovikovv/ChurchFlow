'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import {
  setWebsiteAnalyticsMeasurementIdSchema,
  type SetWebsiteAnalyticsMeasurementIdInput,
  type WebsiteAnalyticsIntegrationStatus,
} from '@churchflow/shared';
import { FormInput } from '@/components/forms/form-input';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { setWebsiteAnalyticsMeasurementIdAction } from '../actions';

export function AnalyticsMeasurementIdDialog({
  currentMeasurementId,
  organizationId,
  triggerLabel,
  onStatusChange,
}: {
  currentMeasurementId: string | null;
  organizationId: string;
  triggerLabel: string;
  onStatusChange: (status: WebsiteAnalyticsIntegrationStatus) => void;
}) {
  const t = useTranslations('website');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();
  const defaultValues = { measurementId: currentMeasurementId ?? '' };
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SetWebsiteAnalyticsMeasurementIdInput>({
    resolver: zodResolver(setWebsiteAnalyticsMeasurementIdSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues,
  });

  const submit = handleSubmit(async ({ measurementId }) => {
    const result = await setWebsiteAnalyticsMeasurementIdAction({ organizationId, measurementId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    onStatusChange(result.data);
    toast.success(t('analytics.measurementIdSaved'));
    dialogRef.current?.close();
  });

  return (
    <FormDialog
      dialogRef={dialogRef}
      title={t('analytics.measurementIdTitle')}
      triggerLabel={triggerLabel}
      onOpen={() => reset(defaultValues)}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            {t('cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting ? t('saving') : t('analytics.save')}
          </Button>
        </div>
      }
    >
      <form className="stack" id={formId} onSubmit={submit} noValidate>
        <p className="m-0 text-sm text-[var(--muted)]">{t('analytics.measurementIdHint')}</p>
        <FormInput
          autoComplete="off"
          label={t('analytics.measurementIdTitle')}
          placeholder="G-ABC123XYZ9"
          spellCheck={false}
          error={errors.measurementId ? t('analytics.measurementIdInvalid') : undefined}
          {...register('measurementId')}
        />
      </form>
    </FormDialog>
  );
}
