'use client';

import { useTranslations } from 'next-intl';
import type { KnowledgeCategory, KnowledgeVisibility } from '@churchflow/shared';
import { FolderIcon, LockIcon } from '@/components/icons/action-icons';
import { MembersIcon } from '@/components/icons/navigation-icons';
import { Badge } from '@/components/ui/badge';
import { KNOWLEDGE_CATEGORY_INTENTS } from './knowledge-lists.styles';

type BadgeSize = 'sm' | 'md';

const ICON_CLASS_NAMES: Record<BadgeSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
};

// The compact list row has no room for the folder icon; the detail header shows it.
export function KnowledgeCategoryBadge({
  category,
  size = 'sm',
}: {
  category: KnowledgeCategory;
  size?: BadgeSize;
}) {
  const t = useTranslations('knowledge');

  return (
    <Badge
      icon={size === 'md' ? <FolderIcon className={ICON_CLASS_NAMES.md} /> : undefined}
      intent={KNOWLEDGE_CATEGORY_INTENTS[category]}
      size={size}
    >
      {t(`categories.${category}`)}
    </Badge>
  );
}

export function KnowledgeVisibilityBadge({
  size = 'sm',
  visibility,
}: {
  size?: BadgeSize;
  visibility: KnowledgeVisibility;
}) {
  const t = useTranslations('knowledge');
  const iconClassName = ICON_CLASS_NAMES[size];

  return (
    <Badge
      icon={
        visibility === 'MEMBERS' ? (
          <MembersIcon className={iconClassName} />
        ) : (
          <LockIcon className={iconClassName} />
        )
      }
      size={size}
    >
      {t(`visibilities.${visibility}`)}
    </Badge>
  );
}
