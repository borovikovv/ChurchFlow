import { useTranslations } from 'next-intl';
import type { MemberAccessMethod } from '@churchflow/shared';
import { StatusBadge } from '@/components/ui/status-badge';

interface SummaryProfile {
  displayName: string;
  email: string | null;
  phone: string | null;
}

export function MemberIdentitySummary({
  archived,
  source,
  profile,
}: {
  archived?: boolean;
  source: string;
  profile: SummaryProfile;
}) {
  const t = useTranslations('members');

  return (
    <div className="grid min-w-0 gap-[3px]">
      <strong>{profile.displayName}</strong>
      <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[var(--muted)]">
        <span className="truncate">
          {source === 'MANUAL' ? t('addedManually') : t('appMember')}
        </span>
        {archived ? <StatusBadge status="archived" label={t('archived')} /> : null}
      </span>
    </div>
  );
}

export function MemberAccessMethodsSummary({ methods }: { methods: MemberAccessMethod[] }) {
  const t = useTranslations('members');

  if (methods.length === 0) return null;

  return (
    <small className="truncate text-[var(--muted)]">
      {methods.map((method) => t(`accessMethodLabels.${method}`)).join(' · ')}
    </small>
  );
}

export function MemberContactSummary({ profile }: { profile: SummaryProfile }) {
  const t = useTranslations('members');

  return (
    <span className="col-start-1 truncate text-[var(--muted)] md:col-auto">
      {profile.phone ?? profile.email ?? t('noContactInformation')}
    </span>
  );
}
