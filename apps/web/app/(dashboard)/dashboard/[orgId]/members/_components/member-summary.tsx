import { useTranslations } from 'next-intl';

interface SummaryProfile {
  displayName: string;
  email: string | null;
  phone: string | null;
}

export function MemberIdentitySummary({
  source,
  profile,
}: {
  source: string;
  profile: SummaryProfile;
}) {
  const t = useTranslations('members');

  return (
    <div className="grid min-w-0 gap-[3px]">
      <strong>{profile.displayName}</strong>
      <span className="truncate text-[var(--muted)]">
        {source === 'MANUAL' ? t('addedManually') : t('appMember')}
      </span>
    </div>
  );
}

export function MemberContactSummary({ profile }: { profile: SummaryProfile }) {
  const t = useTranslations('members');

  return (
    <span className="col-start-1 truncate text-[var(--muted)] md:col-auto">
      {profile.email ?? profile.phone ?? t('noContactInformation')}
    </span>
  );
}
