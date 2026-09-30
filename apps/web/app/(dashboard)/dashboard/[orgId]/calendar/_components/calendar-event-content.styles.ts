import { cva, type VariantProps } from 'class-variance-authority';

export const taskCheckboxClassName = cva('grid place-items-center', {
  variants: {
    placement: {
      overlay:
        'absolute left-1.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
      inline: '-my-3 -ml-3 h-11 w-11 shrink-0',
    },
    canManage: {
      true: 'cursor-pointer',
      false: 'cursor-not-allowed',
    },
  },
});

export type TaskCheckboxPlacement = NonNullable<
  VariantProps<typeof taskCheckboxClassName>['placement']
>;
