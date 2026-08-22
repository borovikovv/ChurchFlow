'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { MemberRoleStatus } from '@/components/members/member-actions';
import { StatusBadge } from '@/components/ui/status-badge';
import type { OrganizationMember } from '../types';
import { MemberAvatar } from './member-avatar';
import { MemberContactSummary, MemberIdentitySummary } from './member-summary';

export function MemberCard({
  actions,
  member,
  viewHref,
}: {
  actions: ReactNode;
  member: OrganizationMember;
  viewHref: Route;
}) {
  const t = useTranslations('members');

  return (
    <>
      <Link className="absolute inset-0 rounded-[var(--radius)]" href={viewHref}>
        <span className="sr-only">{t('viewMember')}</span>
      </Link>
      <div className="flex min-w-0 items-start gap-3">
        <MemberAvatar
          displayName={member.profile.displayName}
          url={member.profile.photoUrl}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <MemberIdentitySummary
            archived={member.status === 'ARCHIVED'}
            source={member.source}
            profile={member.profile}
          />
        </div>
        {actions}
      </div>
      <MemberContactSummary profile={member.profile} />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <StatusBadge
          status={member.accountState}
          label={t(`statusLabels.${member.accountState}`)}
        />
        <MemberRoleStatus role={member.role} />
      </div>
      {member.activeClaim?.status === 'REQUESTED' ? (
        <small className="truncate text-[var(--muted)]">
          {t('requestedBy', {
            name: member.activeClaim.requestedBy?.displayName ?? t('telegramUser'),
          })}
        </small>
      ) : null}
    </>
  );
}
