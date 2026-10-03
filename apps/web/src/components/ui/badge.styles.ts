import { cva } from 'class-variance-authority';

export const badgeClassName = cva(
  'inline-flex w-fit max-w-full items-center gap-1.5 whitespace-nowrap rounded-md font-medium',
  {
    variants: {
      intent: {
        neutral:
          'bg-[var(--surface-subtle)] text-[var(--muted)] ring-1 ring-inset ring-[var(--line-muted)]',
        accent: 'bg-[var(--accent-subtle)] text-[var(--accent-strong)]',
        success: 'bg-[var(--success-subtle)] text-[var(--success-strong)]',
        warning: 'bg-[var(--warning-subtle)] text-[var(--warning)]',
        violet: 'bg-[var(--violet-subtle)] text-[var(--violet)]',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'min-h-8 px-2.5 py-1 text-sm',
      },
    },
    defaultVariants: {
      intent: 'neutral',
      size: 'sm',
    },
  },
);
