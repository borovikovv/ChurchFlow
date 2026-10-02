import { cva } from 'class-variance-authority';

export const pageHeaderClassName = cva('page-header', {
  variants: {
    divider: {
      true: '',
      false: 'border-b-0 pb-0',
    },
  },
  defaultVariants: {
    divider: true,
  },
});
