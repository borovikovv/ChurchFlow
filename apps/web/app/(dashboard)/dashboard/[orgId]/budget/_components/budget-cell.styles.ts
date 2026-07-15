import { cva } from 'class-variance-authority';

export const noteButtonClassName = cva(
  'absolute right-1 top-1 grid h-5 w-5 cursor-pointer place-items-center rounded border bg-[var(--surface)] shadow-sm',
  {
    variants: {
      hasNote: {
        false: 'border-[var(--line)] opacity-0 group-hover/cell:opacity-100 focus:opacity-100',
        true: 'border-[var(--orange)] opacity-100',
      },
    },
  },
);

export const noteIconClassName = cva('h-3.5 w-3.5', {
  variants: {
    hasNote: {
      false: 'bg-[var(--muted)] group-hover/cell:bg-[var(--foreground)]',
      true: 'bg-[var(--orange)]',
    },
  },
});
