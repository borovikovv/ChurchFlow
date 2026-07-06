'use client';

import type { InputHTMLAttributes } from 'react';
import { FormField } from './form-field';

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string | undefined;
  label: string;
};

export function FormInput({ label, error, type = 'text', ...props }: FormInputProps) {
  return (
    <FormField label={label} error={error}>
      {({ id, errorId, invalid }) => (
        <input id={id} type={type} aria-describedby={errorId} aria-invalid={invalid} {...props} />
      )}
    </FormField>
  );
}
