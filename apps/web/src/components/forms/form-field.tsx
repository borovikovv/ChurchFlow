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
    <div className="relative grid gap-1.5 pb-5">
      <label className="font-semibold" htmlFor={id}>
        {label}
      </label>
      {children({ id, errorId, invalid: Boolean(error) })}
      <span
        aria-live="polite"
        className="absolute bottom-0 left-0 text-xs font-medium text-[var(--danger)]"
        id={errorId}
      >
        {error ?? ''}
      </span>
    </div>
  );
}
