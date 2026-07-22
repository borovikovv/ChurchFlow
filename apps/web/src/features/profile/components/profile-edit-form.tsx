'use client';

import type { FormEventHandler } from 'react';
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import type { AppLocale, UpdateCurrentUserProfileInput } from '@churchflow/shared';
import { useTranslations } from 'next-intl';
import { FormDatePicker } from '@/components/forms/form-date-picker';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';

export function ProfileEditForm({
  appLocales,
  control,
  errors,
  register,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  appLocales: readonly AppLocale[];
  control: Control<UpdateCurrentUserProfileInput>;
  errors: FieldErrors<UpdateCurrentUserProfileInput>;
  register: UseFormRegister<UpdateCurrentUserProfileInput>;
  isSubmitting: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCancel: () => void;
}) {
  const t = useTranslations('profile');
  const commonT = useTranslations('common');

  return (
    <form className="grid gap-4" onSubmit={onSubmit} noValidate>
      <FormField label={commonT('name')} error={errors.displayName?.message}>
        {({ id, errorId, invalid }) => (
          <input
            id={id}
            aria-describedby={errorId}
            aria-invalid={invalid}
            autoComplete="name"
            {...register('displayName')}
          />
        )}
      </FormField>
      <FormField label={commonT('email')} error={errors.email?.message}>
        {({ id, errorId, invalid }) => (
          <input
            id={id}
            aria-describedby={errorId}
            aria-invalid={invalid}
            autoComplete="email"
            inputMode="email"
            type="email"
            {...register('email')}
          />
        )}
      </FormField>
      <FormDatePicker
        control={control}
        name="baptizedAt"
        label={t('baptismDate')}
        error={errors.baptizedAt?.message}
      />
      <FormField label={t('baptismChurch')} error={errors.baptismChurchName?.message}>
        {({ id, errorId, invalid }) => (
          <input
            id={id}
            aria-describedby={errorId}
            aria-invalid={invalid}
            {...register('baptismChurchName')}
          />
        )}
      </FormField>
      <FormField label={commonT('language')} error={errors.locale?.message}>
        {({ id, errorId, invalid }) => (
          <select id={id} aria-describedby={errorId} aria-invalid={invalid} {...register('locale')}>
            {appLocales.map((appLocale) => (
              <option key={appLocale} value={appLocale}>
                {commonT(`languages.${appLocale}`)}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
        <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="secondary">
          {commonT('cancel')}
        </Button>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? commonT('saving') : t('saveProfile')}
        </Button>
      </div>
    </form>
  );
}
