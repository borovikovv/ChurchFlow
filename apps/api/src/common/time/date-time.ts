export function validTimeZoneOrFallback(timeZone: string | null | undefined): string {
  const candidate = timeZone || 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'UTC';
  }
}

export function formatDateTime(
  value: Date,
  options: { intlLocale: string; timeZone: string | null | undefined },
): string {
  return new Intl.DateTimeFormat(options.intlLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: validTimeZoneOrFallback(options.timeZone),
  }).format(value);
}
