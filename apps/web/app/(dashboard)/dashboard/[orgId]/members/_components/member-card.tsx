'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { MemberRoleStatus } from '@/components/members/member-actions';
import { StatusBadge } from '@/components/ui/status-badge';
import type { OrganizationMember } from '../types';
import { Avatar } from '@/components/ui/avatar';
import { MailIcon, PhoneIcon } from '@/components/icons/action-icons';
import { MemberIdentitySummary } from './member-summary';
import { GroupBadge } from '@/features/groups/components/group-badge';

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
      <Link className="absolute inset-0 rounded-xl" href={viewHref}>
        <span className="sr-only">{t('viewMember')}</span>
      </Link>
      <div className="flex min-w-0 items-start gap-3">
        <Avatar
          displayName={member.profile.displayName}
          url={member.profile.photoUrl}
          fallback="initials"
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
      <MemberCardContact email={member.profile.email} phone={member.profile.phone} />
      {member.groups.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {member.groups.map((group) => (
            <GroupBadge group={group} key={group.id} />
          ))}
        </div>
      ) : null}
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

function MemberCardContact({ email, phone }: { email: string | null; phone: string | null }) {
  if (phone) {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-[var(--muted)]">
        <PhoneIcon className="h-4 w-4" />
        <span className="truncate">{phone}</span>
      </span>
    );
  }

  if (email) {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-[var(--muted)]">
        <MailIcon className="h-4 w-4" />
        <span className="truncate">{email}</span>
      </span>
    );
  }

  return null;
}
