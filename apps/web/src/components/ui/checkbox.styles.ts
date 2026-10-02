import { cva } from 'class-variance-authority';

const focusRingClassName =
  'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]';

export const checkboxInputClassName = cva(
  'peer absolute left-0 top-1/2 z-10 -translate-y-1/2 cursor-pointer opacity-0 disabled:cursor-not-allowed',
  {
    variants: {
      appearance: {
        checkbox: 'h-4 w-4',
        switch: 'h-5 w-9',
      },
    },
    defaultVariants: {
      appearance: 'checkbox',
    },
  },
);

export const checkboxIndicatorClassName = cva(
  `shrink-0 border border-[var(--line)] shadow-[var(--shadow)] transition-colors group-hover:border-[var(--accent-strong)] peer-disabled:group-hover:border-[var(--line)] ${focusRingClassName}`,
  {
    variants: {
      appearance: {
        checkbox:
          'grid h-4 w-4 place-items-center rounded bg-[var(--surface)] text-[var(--surface)] peer-checked:border-[var(--accent-strong)] peer-checked:bg-[var(--accent-strong)] peer-checked:[&_svg]:opacity-100',
        switch:
          "relative h-5 w-9 rounded-full bg-[var(--line-muted)] after:absolute after:left-0.5 after:top-1/2 after:h-3.5 after:w-3.5 after:-translate-y-1/2 after:rounded-full after:bg-[var(--surface)] after:shadow-sm after:transition-transform after:content-[''] peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)] peer-checked:after:translate-x-4",
      },
    },
    defaultVariants: {
      appearance: 'checkbox',
    },
  },
);
