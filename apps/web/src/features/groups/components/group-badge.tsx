import Link from 'next/link';
import type { Route } from 'next';
import type { OrganizationGroupBadge } from '@churchflow/shared';
import { GROUP_ICON_COMPONENTS } from '@/components/icons/group-icons';
import { groupForegroundColor } from '../lib/group-color';

const BADGE_CLASS_NAME =
  'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold';

export function GroupBadge({ group, href }: { group: OrganizationGroupBadge; href?: Route }) {
  const GroupIcon = GROUP_ICON_COMPONENTS[group.icon];
  const style = { backgroundColor: group.color, color: groupForegroundColor(group.color) };
  const content = (
    <>
      <GroupIcon className="h-4 w-4" />
      <span className="min-w-0 truncate">{group.name}</span>
    </>
  );

  if (!href) {
    return (
      <span className={BADGE_CLASS_NAME} style={style}>
        {content}
      </span>
    );
  }

  return (
    <Link
      className={`${BADGE_CLASS_NAME} no-underline hover:opacity-90`}
      href={href}
      style={style}
    >
      {content}
    </Link>
  );
}
