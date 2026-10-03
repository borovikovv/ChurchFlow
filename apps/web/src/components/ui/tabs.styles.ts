import { cva } from 'class-variance-authority';

export const tabClassName = cva('ui-tab', {
  variants: {
    withIcon: {
      true: 'gap-2',
      false: '',
    },
  },
  defaultVariants: {
    withIcon: false,
  },
});
