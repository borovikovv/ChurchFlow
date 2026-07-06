'use client';

import { useId, type ReactNode } from 'react';

export function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: (accessibility: { id: string; errorId: string; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="grid gap-1.5">
      <label className="font-semibold" htmlFor={id}>
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
