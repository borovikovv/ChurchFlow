'use client';

import type { TextareaHTMLAttributes } from 'react';
import { FormField } from './form-field';

type FormTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string | undefined;
  label: string;
};

export function FormTextarea({ label, error, ...props }: FormTextareaProps) {
  return (
    <FormField label={label} error={error}>
      {({ id, errorId, invalid }) => (
        <textarea id={id} aria-describedby={errorId} aria-invalid={invalid} {...props} />
      )}
    </FormField>
  );
}
