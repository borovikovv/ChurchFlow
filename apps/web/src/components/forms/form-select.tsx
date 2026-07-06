'use client';

import type { ReactNode, SelectHTMLAttributes } from 'react';
import { FormField } from './form-field';

type FormSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
  error?: string | undefined;
  label: string;
};

export function FormSelect({ label, error, children, ...props }: FormSelectProps) {
  return (
    <FormField label={label} error={error}>
      {({ id, errorId, invalid }) => (
        <select id={id} aria-describedby={errorId} aria-invalid={invalid} {...props}>
          {children}
        </select>
      )}
    </FormField>
  );
}
