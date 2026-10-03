// A leap year whose 2 January was a Sunday, so weekday offsets match the API's 0 = Sunday.
const REFERENCE_YEAR = 2000;

/** Standalone month names for a picker, January first. */
export function monthNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });

  return Array.from({ length: 12 }, (_, index) =>
    format.format(new Date(Date.UTC(REFERENCE_YEAR, index, 1))),
  );
}

/** Weekday names for a picker, Sunday (0) first, as the API counts them. */
export function weekdayNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });

  return Array.from({ length: 7 }, (_, index) =>
    format.format(new Date(Date.UTC(REFERENCE_YEAR, 0, 2 + index))),
  );
}
