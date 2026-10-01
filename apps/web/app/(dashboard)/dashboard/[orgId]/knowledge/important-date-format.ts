import type { ImportantDateItem } from '@churchflow/shared';

export const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export type OrdinalKey = 'first' | 'second' | 'third' | 'fourth' | 'last';

const ORDINAL_KEYS: Record<string, OrdinalKey> = {
  '1': 'first',
  '2': 'second',
  '3': 'third',
  '4': 'fourth',
  '-1': 'last',
};

/** What a rule says, with names left as message keys so each language words them itself. */
export type ImportantDateRuleParts =
  | { kind: 'fixed'; dayAndMonth: string }
  | { kind: 'nthWeekday'; ordinal: OrdinalKey; weekday: WeekdayKey; month: string }
  | null;

// A leap year, so 29 February can be named.
const REFERENCE_YEAR = 2000;

function referenceDate(month: number, day: number): Date {
  return new Date(Date.UTC(REFERENCE_YEAR, month - 1, day));
}

/** "4 жовтня" / "October 4": the day with its month in the form the language uses with a day. */
export function formatDayAndMonth(locale: string, month: number, day: number): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    referenceDate(month, day),
  );
}

/** The month as it reads after a day ("жовтня", "October"), not its standalone name. */
export function monthAfterDay(locale: string, month: number): string {
  const parts = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).formatToParts(referenceDate(month, 1));

  return parts.find((part) => part.type === 'month')?.value ?? String(month);
}

/** Standalone month names for a picker, January first. */
export function monthNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });

  return Array.from({ length: 12 }, (_, index) => format.format(referenceDate(index + 1, 1)));
}

/** Weekday names for a picker, Sunday (0) first, as the API counts them. */
export function weekdayNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  // 2 January 2000 was a Sunday.
  return Array.from({ length: 7 }, (_, index) =>
    format.format(new Date(Date.UTC(REFERENCE_YEAR, 0, 2 + index))),
  );
}

export function importantDateRuleParts(
  locale: string,
  item: Pick<ImportantDateItem, 'ruleKind' | 'month' | 'day' | 'weekday' | 'nth'>,
): ImportantDateRuleParts {
  if (item.ruleKind === 'FIXED') {
    return item.day === null
      ? null
      : { kind: 'fixed', dayAndMonth: formatDayAndMonth(locale, item.month, item.day) };
  }

  const weekday = item.weekday === null ? undefined : WEEKDAY_KEYS[item.weekday];
  const ordinal = item.nth === null ? undefined : ORDINAL_KEYS[String(item.nth)];
  if (!weekday || !ordinal) return null;

  return { kind: 'nthWeekday', ordinal, weekday, month: monthAfterDay(locale, item.month) };
}

/** A YYYY-MM-DD date in the reader's language, read as a calendar day rather than an instant. */
export function formatCalendarDay(locale: string, isoDate: string): string {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}
