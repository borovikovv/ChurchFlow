import type { UserSession } from '@churchflow/shared';

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
