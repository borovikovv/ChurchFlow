'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';

type FormCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
};

export function FormCheckbox({ label, className, ...props }: FormCheckboxProps) {
  return (
    <label className="flex items-center gap-2 font-normal">
      <input className={`min-h-0 w-auto ${className ?? ''}`.trim()} type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
