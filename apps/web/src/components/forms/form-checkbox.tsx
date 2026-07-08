'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

type FormCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
};

export function FormCheckbox({ label, className, ...props }: FormCheckboxProps) {
  return (
    <Checkbox inputClassName={className} label={label} labelClassName="font-normal" {...props} />
  );
}
