import { cva } from 'class-variance-authority';

export const tableRowActionsTriggerClassName = cva(
  'grid cursor-pointer list-none place-items-center rounded-[var(--radius)] border text-[var(--foreground)] hover:border-[var(--line)] hover:bg-[var(--surface-subtle)] group-open:border-[var(--accent)] group-open:bg-[var(--surface-subtle)] group-open:ring-2 group-open:ring-[rgba(9,105,218,0.15)] [&::-webkit-details-marker]:hidden',
  {
    variants: {
      appearance: {
        ghost: 'h-9 w-9 border-transparent',
        outline: 'h-8 w-8 border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]',
      },
    },
    defaultVariants: {
      appearance: 'ghost',
    },
  },
);
