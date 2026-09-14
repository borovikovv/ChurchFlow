import { cva } from 'class-variance-authority';

export const richTextEditorFrameClassName = cva(
  'grid w-full overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(208,215,222,0.2)] focus-within:border-[#0969da] focus-within:shadow-none',
  {
    variants: {
      invalid: {
        false: '',
        true: 'border-[var(--danger)] bg-[#fff5f5] shadow-[0_0_0_1px_rgba(207,34,46,0.18)] focus-within:border-[var(--danger-strong)] focus-within:shadow-[0_0_0_3px_rgba(207,34,46,0.14)]',
      },
      disabled: {
        false: '',
        true: 'cursor-not-allowed opacity-70',
      },
    },
    defaultVariants: { invalid: false, disabled: false },
  },
);

export const richTextToolbarClassName =
  'flex flex-wrap gap-1 border-b border-[var(--line)] bg-[var(--surface-muted,transparent)] px-2 py-1.5';

export const richTextToolbarButtonClassName = cva(
  'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm font-semibold leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0969da] disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      active: {
        false:
          'border-transparent text-[var(--muted)] hover:bg-[rgba(31,35,40,0.06)] hover:text-[var(--foreground)]',
        true: 'border-[var(--line)] bg-[rgba(9,105,218,0.1)] text-[#0969da]',
      },
    },
    defaultVariants: { active: false },
  },
);

export const richTextEditorContentClassName =
  'px-3 py-2.5 text-[16px] md:text-[length:inherit] [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[inherit]';
