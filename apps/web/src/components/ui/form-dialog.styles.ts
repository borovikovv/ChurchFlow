import { cva } from 'class-variance-authority';

const dialogBase =
  'fixed inset-0 m-auto max-h-[min(800px,80dvh)] max-w-none rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[0_16px_48px_rgba(31,35,40,0.2)] backdrop:bg-[rgba(31,35,40,0.45)] backdrop:backdrop-blur-[1px]';

export const formDialogClassName = cva(dialogBase, {
  variants: {
    size: {
      sm: 'w-[min(480px,calc(100%-32px))]',
      md: 'w-[min(560px,calc(100%-32px))]',
      lg: 'w-[min(720px,calc(100%-32px))]',
    },
    fullScreenOnMobile: {
      false: '',
      true: 'max-md:h-dvh max-md:max-h-none max-md:w-full max-md:rounded-none',
    },
  },
  defaultVariants: {
    size: 'sm',
    fullScreenOnMobile: false,
  },
});

export const formDialogLayoutClassName = cva(
  'grid max-h-[min(800px,80dvh)] grid-rows-[auto_minmax(0,1fr)_auto]',
  {
    variants: {
      fullScreenOnMobile: {
        false: '',
        true: 'max-md:h-full max-md:max-h-none',
      },
    },
    defaultVariants: {
      fullScreenOnMobile: false,
    },
  },
);
