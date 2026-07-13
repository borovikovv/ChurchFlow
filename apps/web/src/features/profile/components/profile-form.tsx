'use client';

import {
  updateCurrentUserProfileSchema,
  type UpdateCurrentUserProfileInput,
} from '@churchflow/shared';
import { zodResolver } from '@hookform/resolvers/zod';
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
}: {
  displayName: string | null;
  email: string | null;
  platformRole: string;
  baptizedAt: string | null;
  baptismChurchName: string | null;
}) {
  const initialValues = {
    displayName,
    email,
    baptizedAt,
    baptismChurchName,
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
      const nextValues = {
        displayName: values.displayName ?? null,
        email: values.email ?? null,
        baptizedAt: values.baptizedAt ?? null,
        baptismChurchName: values.baptismChurchName ?? null,
      };
      setSavedValues(nextValues);
      reset(nextValues);
      setIsEditing(false);
      toast.success('Profile updated.');
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
        title="Profile"
        description="Your identity and platform access in ChurchFlow."
        actions={
          <Button onClick={() => setIsEditing(true)} type="button" variant="secondary">
            Edit
          </Button>
        }
      >
        <dl className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-x-5">
          <dt className="font-semibold text-[var(--muted)]">Name</dt>
          <dd className="m-0 min-w-0">{savedValues.displayName ?? 'Not set'}</dd>
          <dt className="font-semibold text-[var(--muted)]">Email</dt>
          <dd className="m-0 min-w-0 break-words">{savedValues.email ?? 'Not set'}</dd>
          <dt className="font-semibold text-[var(--muted)]">Platform role</dt>
          <dd className="m-0">
            <StatusBadge status={platformRole} />
          </dd>
          <dt className="font-semibold text-[var(--muted)]">Baptism date</dt>
          <dd className="m-0">
            {savedValues.baptizedAt ? formatIsoDate(savedValues.baptizedAt) : 'Not set'}
          </dd>
          <dt className="font-semibold text-[var(--muted)]">Baptism church</dt>
          <dd className="m-0 min-w-0">
            {savedValues.baptismChurchName?.trim() ? savedValues.baptismChurchName : 'Not set'}
          </dd>
        </dl>
      </ProfileCard>
    );
  }

  return (
    <ProfileCard
      title="Profile"
      description="Update the fields that can be changed for your account."
    >
      <ProfileEditForm
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
