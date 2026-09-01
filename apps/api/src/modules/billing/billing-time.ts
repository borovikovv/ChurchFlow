export const BILLING_TIME_ZONE = 'Europe/Kyiv';

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysFromNow(now: Date, days: number): Date {
  return new Date(now.getTime() + days * DAY_MS);
}

/**
 * Calendar-safe month arithmetic. `setUTCMonth` overflows instead of clamping, so 31 January
 * plus one month lands on 3 March and skips February entirely - which would put a visibly wrong
 * next-charge date in front of every organization that subscribes at the end of a month.
 */
export function addMonths(from: Date, months: number): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + months;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(from.getUTCDate(), lastDayOfTargetMonth),
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
}

/** Stable day-granular key for notification deduplication. */
export function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}
