'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  updateCurrentUserProfileSchema,
  type UpdateCurrentUserProfileInput,
} from '@churchflow/shared';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { FormDatePicker } from '@/components/forms/form-date-picker';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { updateCurrentUserProfile } from '../actions';

export function ProfileForm({
  baptizedAt,
  baptismChurchName,
}: {
  baptizedAt: string | null;
  baptismChurchName: string | null;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateCurrentUserProfileInput>({
    resolver: zodResolver(updateCurrentUserProfileSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { baptizedAt, baptismChurchName },
  });

  const submit = handleSubmit(async (values) => {
    const result = await updateCurrentUserProfile(values);
    if (result.ok) toast.success('Profile updated.');
    else toast.error(result.error);
  });

  return (
    <form className="form-grid max-w-xl" onSubmit={submit} noValidate>
      <FormDatePicker
        control={control}
        name="baptizedAt"
        label="Baptism date"
        error={errors.baptizedAt?.message}
      />
      <FormField label="Baptism church" error={errors.baptismChurchName?.message}>
        {({ id, errorId, invalid }) => (
          <input
            id={id}
            aria-describedby={errorId}
            aria-invalid={invalid}
            {...register('baptismChurchName')}
          />
        )}
      </FormField>
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}
