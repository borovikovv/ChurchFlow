import { cva } from 'class-variance-authority';

export const boardDropZoneVariants = cva(
  'nodrag nopan grid gap-1 rounded-[var(--radius)] border border-dashed p-1.5 transition-colors',
  {
    variants: {
      state: {
        idle: 'border-transparent',
        ready: 'border-[var(--line)] bg-[var(--surface-subtle)]',
        over: 'border-[var(--accent)] bg-[var(--surface-subtle)]',
      },
    },
  },
);

/** A member list that scrolls inside its node instead of zooming the canvas. */
export const boardMemberListClassName = 'nowheel m-0 grid list-none gap-0.5 overflow-y-auto p-0';

export const boardNodeClassName =
  'grid w-72 gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-sm';

export const boardNodeHeaderClassName =
  'board-node-handle flex min-w-0 cursor-grab items-center justify-between gap-2 rounded-[var(--radius)] px-1.5 py-1 active:cursor-grabbing';
