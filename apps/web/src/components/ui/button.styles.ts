import { cva } from 'class-variance-authority';

export const buttonClassName = cva('ui-button', {
  variants: {
    variant: {
      primary: 'ui-button-primary',
      secondary: 'ui-button-secondary',
      danger: 'ui-button-danger',
      ghost: 'ui-button-ghost',
    },
    size: {
      default: '',
      icon: 'h-8 w-8 px-0',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'default',
  },
});
