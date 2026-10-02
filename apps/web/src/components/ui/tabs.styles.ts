import { cva } from 'class-variance-authority';

export const tabClassName = cva('ui-tab', {
  variants: {
    intent: {
      neutral: '',
      accent:
        'gap-2 md:aria-[current=page]:border-b-[var(--accent)] md:aria-[current=page]:text-[var(--accent)]',
    },
  },
  defaultVariants: {
    intent: 'neutral',
  },
});
