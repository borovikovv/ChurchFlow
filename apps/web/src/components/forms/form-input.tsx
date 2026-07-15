'use client';

import type { InputHTMLAttributes } from 'react';
import { FormField } from './form-field';

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string | undefined;
  fieldClassName?: string | undefined;
  label: string;
  labelClassName?: string | undefined;
};

export function FormInput({
  label,
  error,
  fieldClassName,
  labelClassName,
  type = 'text',
  ...props
}: FormInputProps) {
  return (
    <FormField
      label={label}
      error={error}
      {...(fieldClassName ? { className: fieldClassName } : {})}
      {...(labelClassName ? { labelClassName } : {})}
    >
      {({ id, errorId, invalid }) => (
        <input id={id} type={type} aria-describedby={errorId} aria-invalid={invalid} {...props} />
      )}
    </FormField>
  );
}
