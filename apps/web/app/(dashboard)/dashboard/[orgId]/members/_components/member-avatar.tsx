type MemberAvatarSize = 'sm' | 'md' | 'lg';

const avatarSizeClasses: Record<MemberAvatarSize, string> = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-14 w-14 text-lg',
  lg: 'h-20 w-20 text-2xl sm:h-24 sm:w-24 sm:text-3xl',
};

export function MemberAvatar({
  displayName,
  url,
  size = 'sm',
}: {
  displayName: string;
  url: string | null;
  size?: MemberAvatarSize;
}) {
  const sizeClass = avatarSizeClasses[size];

  return url ? (
    // Signed private URLs are short-lived and cannot use a stable Next image loader.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`${sizeClass} shrink-0 rounded-full object-cover`} src={url} alt="" />
  ) : (
    <span
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full border border-[rgba(9,105,218,0.22)] bg-[#ddf4ff] font-semibold text-[var(--accent-strong)] ring-1 ring-[rgba(9,105,218,0.08)]`}
      aria-hidden="true"
    >
      {memberInitials(displayName)}
    </span>
  );
}

function memberInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part.at(0))
    .join('');

  return initials.toUpperCase() || '?';
}
