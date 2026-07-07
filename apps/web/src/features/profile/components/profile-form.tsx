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
import { formatIsoDate } from '@/lib/format-date';
import { updateCurrentUserProfile } from '../actions';
import { ProfileCard } from './profile-card';
import { ProfileEditForm } from './profile-edit-form';

export function ProfileForm({
  baptizedAt,
  baptismChurchName,
}: {
  baptizedAt: string | null;
  baptismChurchName: string | null;
}) {
  const initialValues = {
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
        title="Profile details"
        description="View and update the editable information tied to your account."
        actions={
          <Button onClick={() => setIsEditing(true)} type="button" variant="secondary">
            Edit
          </Button>
        }
      >
        <dl className="details">
          <dt>Baptism date</dt>
          <dd>{savedValues.baptizedAt ? formatIsoDate(savedValues.baptizedAt) : 'Not set'}</dd>
          <dt>Baptism church</dt>
          <dd>
            {savedValues.baptismChurchName?.trim() ? savedValues.baptismChurchName : 'Not set'}
          </dd>
        </dl>
      </ProfileCard>
    );
  }

  return (
    <ProfileCard
      title="Edit profile"
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
