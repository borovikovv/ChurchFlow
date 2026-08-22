import type { UserSession } from '@churchflow/shared';

// A session that has never been touched still has a creation date, and showing that is
// more useful to someone scanning the list than an empty cell.
export function formatLastUsed(
  session: UserSession,
  locale: string,
  labels: { never: string; lastUsed: (value: string) => string },
): string {
  if (!session.lastUsedAt) {
    return labels.never;
  }

  return labels.lastUsed(
    new Date(session.lastUsedAt).toLocaleString(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
  );
}
