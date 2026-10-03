import { cva } from 'class-variance-authority';
import type { KnowledgeCategory } from '@churchflow/shared';
import type { BadgeIntent } from '@/components/ui/badge';

export const knowledgeListClassNames = {
  title: 'font-bold [overflow-wrap:anywhere]',
  detailLabel: 'text-xs text-[var(--muted)]',
  panel:
    'min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]',
  listPanel:
    'min-w-0 md:overflow-hidden md:rounded-xl md:border md:border-[var(--line)] md:bg-[var(--surface)] md:shadow-[var(--shadow)]',
  sectionHeading: 'm-0 pb-2 pt-2 md:px-4 md:pb-1 md:pt-4 text-sm font-semibold text-[var(--muted)]',
};

export const KNOWLEDGE_CATEGORY_INTENTS: Record<KnowledgeCategory, BadgeIntent> = {
  TRADITION: 'accent',
  MINISTRY: 'success',
  INSTRUCTION: 'neutral',
  AGREEMENT: 'warning',
  THEOLOGY: 'violet',
  OTHER: 'neutral',
};

// Phones show the rows as separate cards without the selected highlight.
export const knowledgeListItemClassName = cva(
  'relative grid w-full min-w-0 gap-1.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-[var(--accent)] max-md:rounded-xl max-md:border max-md:border-[var(--line)] max-md:bg-[var(--surface)] max-md:p-4 max-md:shadow-sm md:border-l-[3px] md:px-4 md:py-3',
  {
    variants: {
      selected: {
        true: 'md:border-l-[var(--accent)] md:bg-[var(--accent-subtle)]',
        false: 'md:border-l-transparent md:bg-transparent md:hover:bg-[var(--surface-subtle)]',
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
);
