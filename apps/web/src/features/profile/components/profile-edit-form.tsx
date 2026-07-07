'use client';

import type { FormEventHandler } from 'react';
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import type { UpdateCurrentUserProfileInput } from '@churchflow/shared';
import { FormDatePicker } from '@/components/forms/form-date-picker';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';

export function ProfileEditForm({
  control,
  errors,
  register,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  control: Control<UpdateCurrentUserProfileInput>;
  errors: FieldErrors<UpdateCurrentUserProfileInput>;
  register: UseFormRegister<UpdateCurrentUserProfileInput>;
  isSubmitting: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCancel: () => void;
}) {
  return (
    <form className="form-grid" onSubmit={onSubmit} noValidate>
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
      <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
        <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="secondary">
          Cancel
        </Button>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Saving...' : 'Save profile'}
        </Button>
      </div>
    </form>
  );
}
