'use client';

import {
  APP_LOCALES,
  updateCurrentUserProfileSchema,
  type AppLocale,
  type UpdateCurrentUserProfileInput,
} from '@churchflow/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatIsoDate } from '@/lib/format-date';
import { updateCurrentUserProfile } from '../actions';
import { ProfileCard } from './profile-card';
import { ProfileEditForm } from './profile-edit-form';

export function ProfileForm({
  displayName,
  email,
  platformRole,
  baptizedAt,
  baptismChurchName,
  locale,
}: {
  displayName: string | null;
  email: string | null;
  platformRole: string;
  baptizedAt: string | null;
  baptismChurchName: string | null;
  locale: AppLocale;
}) {
  const router = useRouter();
  const t = useTranslations('profile');
  const commonT = useTranslations('common');
  const initialValues = {
    displayName,
    email,
    baptizedAt,
    baptismChurchName,
    locale,
  };
  const [isEditing, setIsEditing] = useState(false);
  const [savedValues, setSavedValues] = useState(initialValues);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateCurrentUserProfileInput>({
    resolver: zodResolver(updateCurrentUserProfileSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: savedValues,
  });

  const submit = handleSubmit(async (values) => {
    const result = await updateCurrentUserProfile(values);
    if (result.ok) {
      const localeChanged = values.locale !== savedValues.locale;
      const nextValues = {
        displayName: values.displayName ?? null,
        email: values.email ?? null,
        baptizedAt: values.baptizedAt ?? null,
        baptismChurchName: values.baptismChurchName ?? null,
        locale: values.locale ?? savedValues.locale,
      };
      setSavedValues(nextValues);
      reset(nextValues);
      setIsEditing(false);
      toast.success(t('updated'));
      if (localeChanged) {
        router.refresh();
      }
      return;
    }

    toast.error(result.error);
  });

  const cancelEditing = () => {
    reset(savedValues);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <ProfileCard
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={() => setIsEditing(true)} type="button" variant="secondary">
            {commonT('edit')}
          </Button>
        }
      >
        <dl className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-x-5">
          <dt className="font-semibold text-[var(--muted)]">{commonT('name')}</dt>
          <dd className="m-0 min-w-0">{savedValues.displayName ?? commonT('notSet')}</dd>
          <dt className="font-semibold text-[var(--muted)]">{commonT('email')}</dt>
          <dd className="m-0 min-w-0 break-words">{savedValues.email ?? commonT('notSet')}</dd>
          <dt className="font-semibold text-[var(--muted)]">{t('platformRole')}</dt>
          <dd className="m-0">
            <StatusBadge status={platformRole} />
          </dd>
          <dt className="font-semibold text-[var(--muted)]">{commonT('language')}</dt>
          <dd className="m-0">{commonT(`languages.${savedValues.locale}`)}</dd>
          <dt className="font-semibold text-[var(--muted)]">{t('baptismDate')}</dt>
          <dd className="m-0">
            {savedValues.baptizedAt ? formatIsoDate(savedValues.baptizedAt) : commonT('notSet')}
          </dd>
          <dt className="font-semibold text-[var(--muted)]">{t('baptismChurch')}</dt>
          <dd className="m-0 min-w-0">
            {savedValues.baptismChurchName?.trim()
              ? savedValues.baptismChurchName
              : commonT('notSet')}
          </dd>
        </dl>
      </ProfileCard>
    );
  }

  return (
    <ProfileCard title={t('title')} description={t('editDescription')}>
      <ProfileEditForm
        appLocales={APP_LOCALES}
        control={control}
        errors={errors}
        isSubmitting={isSubmitting}
        onCancel={cancelEditing}
        onSubmit={submit}
        register={register}
      />
    </ProfileCard>
  );
}
