export function formatPasskeyLastUsed(
  lastUsedAt: string | null,
  locale: string,
  labels: { never: string; lastUsed: (value: string) => string },
): string {
  if (!lastUsedAt) {
    return labels.never;
  }

  return labels.lastUsed(
    new Date(lastUsedAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }),
  );
}
