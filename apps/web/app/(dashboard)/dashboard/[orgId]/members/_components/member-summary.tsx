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
  return (
    <div className="grid min-w-0 gap-[3px]">
      <strong>{profile.displayName}</strong>
      <span className="truncate text-[var(--muted)]">
        {source === 'MANUAL' ? 'Added manually' : 'App member'}
      </span>
    </div>
  );
}

export function MemberContactSummary({ profile }: { profile: SummaryProfile }) {
  return (
    <span className="col-start-1 truncate text-[var(--muted)] md:col-auto">
      {profile.email ?? profile.phone ?? 'No contact information'}
    </span>
  );
}
