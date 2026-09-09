import { cva } from 'class-variance-authority';

export const iconOptionClassName = cva(
  'flex h-10 w-10 cursor-pointer items-center justify-center rounded-[var(--radius)] border bg-[var(--surface)] text-[var(--foreground)] transition-colors',
  {
    variants: {
      selected: {
        true: 'border-[var(--accent)] ring-2 ring-[rgba(22,163,74,0.2)]',
        false: 'border-[var(--line)] hover:bg-[var(--surface-subtle)]',
      },
    },
  },
);

export const colorSwatchClassName = cva(
  'flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-sm font-bold transition-transform',
  {
    variants: {
      selected: {
        true: 'ring-2 ring-[var(--foreground)] ring-offset-2 ring-offset-[var(--surface)]',
        false: 'hover:scale-105',
      },
    },
  },
);
