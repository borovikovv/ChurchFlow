'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'> & {
  label: ReactNode;
  inputClassName?: string | undefined;
  labelClassName?: string | undefined;
  textClassName?: string | undefined;
};

export function Checkbox({
  label,
  inputClassName,
  labelClassName,
  textClassName,
  ...props
}: CheckboxProps) {
  return (
    <label
      className={`group flex min-w-0 cursor-pointer items-center gap-2 text-sm font-semibold ${props.disabled ? 'cursor-not-allowed opacity-60' : ''} ${labelClassName ?? ''}`.trim()}
    >
      <input className={`peer sr-only ${inputClassName ?? ''}`.trim()} type="checkbox" {...props} />
      <span className="grid h-4 w-4 shrink-0 place-items-center rounded border border-[var(--line)] bg-[var(--surface)] text-[var(--surface)] shadow-[var(--shadow)] transition-colors group-hover:border-[var(--accent-strong)] peer-checked:border-[var(--accent-strong)] peer-checked:bg-[var(--accent-strong)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)] peer-disabled:group-hover:border-[var(--line)] peer-checked:[&_svg]:opacity-100">
        <svg
          aria-hidden="true"
          className="h-3 w-3 opacity-0 transition-opacity"
          fill="none"
          viewBox="0 0 16 16"
        >
          <path
            d="M3.5 8.2 6.6 11 12.5 5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.2"
          />
        </svg>
      </span>
      <span className={textClassName}>{label}</span>
    </label>
  );
}
