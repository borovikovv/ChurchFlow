'use client';

import type { VariantProps } from 'class-variance-authority';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { checkboxIndicatorClassName, checkboxInputClassName } from './checkbox.styles';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'> & {
  appearance?: VariantProps<typeof checkboxInputClassName>['appearance'];
  label: ReactNode;
  inputClassName?: string | undefined;
  labelClassName?: string | undefined;
  textClassName?: string | undefined;
};

export function Checkbox({
  appearance,
  label,
  inputClassName,
  labelClassName,
  textClassName,
  ...props
}: CheckboxProps) {
  return (
    <label
      className={`group relative flex min-w-0 cursor-pointer items-center gap-2 text-sm font-semibold ${props.disabled ? 'cursor-not-allowed opacity-60' : ''} ${labelClassName ?? ''}`.trim()}
    >
      <input
        className={checkboxInputClassName({ appearance, className: inputClassName })}
        role={appearance === 'switch' ? 'switch' : undefined}
        type="checkbox"
        {...props}
      />
      <span className={checkboxIndicatorClassName({ appearance })}>
        {appearance === 'switch' ? null : (
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
        )}
      </span>
      <span className={textClassName}>{label}</span>
    </label>
  );
}
