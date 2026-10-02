import { cva } from 'class-variance-authority';
import type { KnowledgeCategory } from '@churchflow/shared';
import type { BadgeIntent } from '@/components/ui/badge';

export const nowrapColumnMeta = {
  headerClassName: 'whitespace-nowrap',
  cellClassName: 'whitespace-nowrap',
};

export const knowledgeListClassNames = {
  title: 'font-bold [overflow-wrap:anywhere]',
  detailLabel: 'text-xs text-[var(--muted)]',
  panel:
    'min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]',
  sectionHeading: 'm-0 px-4 pb-1 pt-4 text-sm font-semibold text-[var(--muted)]',
};

export const KNOWLEDGE_CATEGORY_INTENTS: Record<KnowledgeCategory, BadgeIntent> = {
  TRADITION: 'accent',
  MINISTRY: 'success',
  INSTRUCTION: 'neutral',
  AGREEMENT: 'warning',
  THEOLOGY: 'violet',
  OTHER: 'neutral',
};

export const knowledgeNoteListItemClassName = cva(
  'relative grid w-full min-w-0 gap-1.5 border-l-[3px] px-4 py-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]',
  {
    variants: {
      selected: {
        true: 'border-l-[var(--accent)] bg-[var(--accent-subtle)]',
        false: 'border-l-transparent bg-transparent hover:bg-[var(--surface-subtle)]',
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
);
