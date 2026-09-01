'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { OrganizationGroupListItem } from '@churchflow/shared';
import { GroupBadge } from '@/features/groups/components/group-badge';

export function GroupCard({
  actions,
  group,
  viewHref,
}: {
  actions: ReactNode;
  group: OrganizationGroupListItem;
  viewHref: Route;
}) {
  const t = useTranslations('groups');

  return (
    <>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <Link className="min-w-0 no-underline" href={viewHref}>
          <GroupBadge group={group} />
        </Link>
        {actions}
      </div>
      {group.description ? (
        <p className="m-0 line-clamp-2 text-sm text-[var(--muted)]">{group.description}</p>
      ) : null}
      <dl className="m-0 grid grid-cols-2 gap-2 text-sm">
        <div className="min-w-0">
          <dt className="text-[var(--muted)]">{t('members')}</dt>
          <dd className="m-0 font-semibold">{group.memberCount}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[var(--muted)]">{t('leaders')}</dt>
          <dd className="m-0 truncate font-semibold">
            {group.leaders.length > 0
              ? group.leaders.map((leader) => leader.displayName).join(', ')
              : t('noLeaders')}
          </dd>
        </div>
      </dl>
    </>
  );
}
