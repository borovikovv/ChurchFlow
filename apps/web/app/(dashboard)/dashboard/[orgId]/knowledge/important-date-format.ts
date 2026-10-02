import {
  IMPORTANT_DATE_NTH_VALUES,
  importantDateRuleOf,
  type ImportantDateItem,
  type ImportantDateNth,
} from '@churchflow/shared';

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

export const ORDINAL_KEYS: Record<ImportantDateNth, OrdinalKey> = {
  1: 'first',
  2: 'second',
  3: 'third',
  4: 'fourth',
  [-1]: 'last',
};

function ordinalKeyOf(nth: number): OrdinalKey | undefined {
  const value = IMPORTANT_DATE_NTH_VALUES.find((allowed) => allowed === nth);

  return value === undefined ? undefined : ORDINAL_KEYS[value];
}

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

export function importantDateRuleParts(
  locale: string,
  item: Pick<ImportantDateItem, 'ruleKind' | 'month' | 'day' | 'weekday' | 'nth'>,
): ImportantDateRuleParts {
  const rule = importantDateRuleOf(item);
  if (!rule) return null;
  if (rule.ruleKind === 'FIXED') {
    return { kind: 'fixed', dayAndMonth: formatDayAndMonth(locale, rule.month, rule.day) };
  }

  const weekday = WEEKDAY_KEYS[rule.weekday];
  const ordinal = ordinalKeyOf(rule.nth);
  if (!weekday || !ordinal) return null;

  return { kind: 'nthWeekday', ordinal, weekday, month: monthAfterDay(locale, rule.month) };
}

/** A YYYY-MM-DD date in the reader's language, read as a calendar day rather than an instant. */
export function formatCalendarDay(locale: string, isoDate: string): string {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}
