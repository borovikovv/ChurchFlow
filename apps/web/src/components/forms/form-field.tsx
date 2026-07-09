'use client';

import { useId, type ReactNode } from 'react';

export function FormField({
  label,
  error,
  className = 'grid gap-1.5',
  labelClassName = 'font-semibold',
  children,
}: {
  label: string;
  error?: string | undefined;
  className?: string | undefined;
  labelClassName?: string | undefined;
  children: (accessibility: { id: string; errorId: string; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={className}>
      <label className={labelClassName} htmlFor={id}>
        {label}
      </label>
      {children({ id, errorId, invalid: Boolean(error) })}
      {error ? (
        <span aria-live="polite" className="text-xs font-medium text-[var(--danger)]" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
