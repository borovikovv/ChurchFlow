import { cva } from 'class-variance-authority';

export const aiAssistantToolChipClassName = cva(
  'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
  {
    variants: {
      status: {
        running: 'border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted)]',
        done: 'border-[#4ac26b66] bg-[#dafbe1] text-[var(--success)]',
        error: 'border-[#ff818266] bg-[#ffebe9] text-[var(--danger)]',
        denied: 'border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted)] line-through',
      },
    },
  },
);

export const aiAssistantToolDotClassName = cva('h-1.5 w-1.5 shrink-0 rounded-full bg-current', {
  variants: {
    status: {
      running: 'animate-pulse',
      done: '',
      error: '',
      denied: '',
    },
  },
});
