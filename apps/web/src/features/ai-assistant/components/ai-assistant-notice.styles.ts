import { cva } from 'class-variance-authority';

export const aiAssistantNoticeClassName = cva(
  'm-0 grid gap-2 rounded-[var(--radius)] border px-3 py-2 text-sm',
  {
    variants: {
      tone: {
        muted: 'border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted)]',
        warning: 'border-[#d4a72c66] bg-[#fff8c5] text-[var(--warning)]',
        danger: 'border-[#ff818266] bg-[#ffebe9] text-[var(--danger)]',
      },
    },
    defaultVariants: { tone: 'muted' },
  },
);

export const aiAssistantUsageTextClassName = cva('m-0 text-xs', {
  variants: {
    tone: {
      muted: 'text-[var(--muted)]',
      warning: 'font-semibold text-[var(--warning)]',
    },
  },
  defaultVariants: { tone: 'muted' },
});
