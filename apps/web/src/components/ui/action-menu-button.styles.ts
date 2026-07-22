import { cva } from 'class-variance-authority';

export const actionMenuButtonClassName = cva('ui-button gap-2', {
  variants: {
    size: {
      full: 'h-[42px] min-h-[42px]',
      medium: 'h-8 min-h-8',
    },
  },
  defaultVariants: {
    size: 'full',
  },
});
