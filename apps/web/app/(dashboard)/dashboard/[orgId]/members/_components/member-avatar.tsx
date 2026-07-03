export function MemberAvatar({ displayName, url }: { displayName: string; url: string | null }) {
  return url ? (
    // Signed private URLs are short-lived and cannot use a stable Next image loader.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="h-10 w-10 rounded-full object-cover" src={url} alt="" />
  ) : (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-subtle)] font-semibold"
      aria-hidden="true"
    >
      {displayName.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}
