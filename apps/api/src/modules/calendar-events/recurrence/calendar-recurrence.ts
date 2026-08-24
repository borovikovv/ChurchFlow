import { CALENDAR_EVENT_REPEAT_PERIOD, type CalendarEventRepeatPeriod } from '@churchflow/shared';
import { validTimeZoneOrFallback } from '../../../common/time/date-time';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DAILY_REPEAT_STEP_DAYS = 1;
const WEEKLY_REPEAT_STEP_DAYS = 7;
const MONTHLY_REPEAT_STEP_MONTHS = 1;
const YEARLY_REPEAT_STEP_YEARS = 1;

export const MAX_EXPANDED_OCCURRENCES_PER_EVENT = 500;
export const MAX_OCCURRENCE_SEARCH_STEPS = 5000;

export class CalendarRecurrenceError extends Error {
  constructor(
    readonly code:
      | 'CALENDAR_REPEAT_DID_NOT_ADVANCE'
      | 'CALENDAR_REPEAT_EXPANSION_LIMIT_REACHED'
      | 'CALENDAR_REPEAT_SEARCH_LIMIT_REACHED',
    message: string,
    readonly context: Record<string, unknown>,
  ) {
    super(message);
  }
}

export interface CalendarRecurrenceEvent {
  startsAt: Date;
  endsAt: Date | null;
  repeatPeriod: CalendarEventRepeatPeriod;
}

export interface CalendarOccurrence {
  startsAt: Date;
  endsAt: Date | null;
}

export interface ExpandCalendarEventOccurrencesInput {
  event: CalendarRecurrenceEvent;
  rangeStart: Date;
  rangeEnd: Date;
  timeZone?: string | null | undefined;
}

export interface GetOccurrenceStartsInput {
  startsAt: Date;
  repeatPeriod: CalendarEventRepeatPeriod;
  rangeStart: Date;
  rangeEnd: Date;
  timeZone?: string | null | undefined;
  includeRangeEnd?: boolean;
  maxOccurrences?: number;
}

export function expandCalendarEventOccurrences({
  event,
  rangeStart,
  rangeEnd,
  timeZone,
}: ExpandCalendarEventOccurrencesInput): CalendarOccurrence[] {
  if (event.repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.none) {
    return overlaps(event.startsAt, event.endsAt, rangeStart, rangeEnd)
      ? [{ startsAt: event.startsAt, endsAt: event.endsAt }]
      : [];
  }

  const duration = event.endsAt ? event.endsAt.getTime() - event.startsAt.getTime() : null;
  const occurrenceSearchStart =
    duration === null ? rangeStart : new Date(rangeStart.getTime() - Math.max(duration, 0));
  const occurrenceStarts = getOccurrenceStarts({
    startsAt: event.startsAt,
    repeatPeriod: event.repeatPeriod,
    rangeStart: occurrenceSearchStart,
    rangeEnd,
    timeZone,
    maxOccurrences: MAX_EXPANDED_OCCURRENCES_PER_EVENT,
  });

  return occurrenceStarts
    .map((startsAt) => ({
      startsAt,
      endsAt: duration === null ? null : new Date(startsAt.getTime() + duration),
    }))
    .filter((occurrence) => overlaps(occurrence.startsAt, occurrence.endsAt, rangeStart, rangeEnd));
}

export function getOccurrenceStarts({
  startsAt,
  repeatPeriod,
  rangeStart,
  rangeEnd,
  timeZone,
  includeRangeEnd = false,
  maxOccurrences = MAX_EXPANDED_OCCURRENCES_PER_EVENT,
}: GetOccurrenceStartsInput): Date[] {
  if (repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.none) {
    const inRange = includeRangeEnd
      ? startsAt >= rangeStart && startsAt <= rangeEnd
      : startsAt >= rangeStart && startsAt < rangeEnd;
    return inRange ? [startsAt] : [];
  }

  const occurrenceStarts: Date[] = [];
  let occurrenceStart = firstOccurrenceInRange(startsAt, repeatPeriod, rangeStart, timeZone);
  let guard = 0;

  while (occurrenceStart < rangeStart && guard < MAX_OCCURRENCE_SEARCH_STEPS) {
    occurrenceStart = nextOccurrenceAfter(occurrenceStart, repeatPeriod, timeZone);
    guard += 1;
  }
  if (occurrenceStart < rangeStart) {
    throw new CalendarRecurrenceError(
      'CALENDAR_REPEAT_SEARCH_LIMIT_REACHED',
      'Could not advance repeated calendar occurrence into range within search limit',
      {
        repeatPeriod,
        startsAt: startsAt.toISOString(),
        rangeStart: rangeStart.toISOString(),
        maxSearchSteps: MAX_OCCURRENCE_SEARCH_STEPS,
        lastOccurrenceStart: occurrenceStart.toISOString(),
        timeZone: validTimeZoneOrFallback(timeZone),
      },
    );
  }

  while (
    isOccurrenceBeforeRangeEnd(occurrenceStart, rangeEnd, includeRangeEnd) &&
    guard < maxOccurrences
  ) {
    occurrenceStarts.push(new Date(occurrenceStart));
    occurrenceStart = nextOccurrenceAfter(occurrenceStart, repeatPeriod, timeZone);
    guard += 1;
  }

  if (isOccurrenceBeforeRangeEnd(occurrenceStart, rangeEnd, includeRangeEnd)) {
    throw new CalendarRecurrenceError(
      'CALENDAR_REPEAT_EXPANSION_LIMIT_REACHED',
      'Stopped expanding repeated calendar event after hitting occurrence limit',
      {
        repeatPeriod,
        maxOccurrences,
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
        lastOccurrenceStart: occurrenceStart.toISOString(),
        timeZone: validTimeZoneOrFallback(timeZone),
      },
    );
  }

  return occurrenceStarts;
}

export function zonedDateTimeToUtc(
  parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone: string | null | undefined,
): Date {
  const utcGuess = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  );
  const offset = timeZoneOffsetMs(utcGuess, timeZone);
  const adjusted = new Date(utcGuess.getTime() - offset);
  const adjustedOffset = timeZoneOffsetMs(adjusted, timeZone);

  return new Date(utcGuess.getTime() - adjustedOffset);
}

export function zonedDateParts(value: Date, timeZone: string | null | undefined) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: validTimeZoneOrFallback(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: parts['year'] ?? value.getUTCFullYear(),
    month: parts['month'] ?? value.getUTCMonth() + 1,
    day: parts['day'] ?? value.getUTCDate(),
    hour: parts['hour'] ?? value.getUTCHours(),
    minute: parts['minute'] ?? value.getUTCMinutes(),
    second: parts['second'] ?? value.getUTCSeconds(),
  };
}

function firstOccurrenceInRange(
  startsAt: Date,
  repeatPeriod: CalendarEventRepeatPeriod,
  rangeStart: Date,
  timeZone: string | null | undefined,
): Date {
  const occurrenceStart = new Date(startsAt);
  fastForwardDailyOrWeeklyOccurrence(occurrenceStart, startsAt, repeatPeriod, rangeStart, timeZone);
  let guard = 0;

  while (guard < MAX_OCCURRENCE_SEARCH_STEPS) {
    const next = nextOccurrenceAfter(occurrenceStart, repeatPeriod, timeZone);
    if (next > rangeStart) return occurrenceStart;

    occurrenceStart.setTime(next.getTime());
    guard += 1;
  }

  throw new CalendarRecurrenceError(
    'CALENDAR_REPEAT_SEARCH_LIMIT_REACHED',
    'Could not find first repeated calendar occurrence within search limit',
    {
      repeatPeriod,
      startsAt: startsAt.toISOString(),
      rangeStart: rangeStart.toISOString(),
      maxSearchSteps: MAX_OCCURRENCE_SEARCH_STEPS,
      lastOccurrenceStart: occurrenceStart.toISOString(),
      timeZone: validTimeZoneOrFallback(timeZone),
    },
  );
}

function fastForwardDailyOrWeeklyOccurrence(
  occurrenceStart: Date,
  startsAt: Date,
  repeatPeriod: CalendarEventRepeatPeriod,
  rangeStart: Date,
  timeZone: string | null | undefined,
): void {
  if (
    repeatPeriod !== CALENDAR_EVENT_REPEAT_PERIOD.daily &&
    repeatPeriod !== CALENDAR_EVENT_REPEAT_PERIOD.weekly
  ) {
    return;
  }

  const intervalMs =
    repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.daily
      ? MILLISECONDS_PER_DAY
      : WEEKLY_REPEAT_STEP_DAYS * MILLISECONDS_PER_DAY;
  const elapsedIntervals = Math.floor((rangeStart.getTime() - startsAt.getTime()) / intervalMs);
  if (elapsedIntervals <= 0) return;

  const parts = zonedDateParts(startsAt, timeZone);
  const localDate = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  );
  localDate.setUTCDate(
    localDate.getUTCDate() +
      elapsedIntervals *
        (repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.daily
          ? DAILY_REPEAT_STEP_DAYS
          : WEEKLY_REPEAT_STEP_DAYS),
  );
  occurrenceStart.setTime(
    zonedDateTimeToUtc(
      {
        year: localDate.getUTCFullYear(),
        month: localDate.getUTCMonth() + 1,
        day: localDate.getUTCDate(),
        hour: localDate.getUTCHours(),
        minute: localDate.getUTCMinutes(),
        second: localDate.getUTCSeconds(),
      },
      timeZone,
    ).getTime(),
  );
}

function nextOccurrenceAfter(
  value: Date,
  repeatPeriod: CalendarEventRepeatPeriod,
  timeZone: string | null | undefined,
): Date {
  const next = nextOccurrence(value, repeatPeriod, timeZone);
  if (next <= value) {
    throw new CalendarRecurrenceError(
      'CALENDAR_REPEAT_DID_NOT_ADVANCE',
      'Calendar repeat calculation did not advance occurrence date',
      {
        repeatPeriod,
        currentOccurrenceStart: value.toISOString(),
        nextOccurrenceStart: next.toISOString(),
        timeZone: validTimeZoneOrFallback(timeZone),
      },
    );
  }

  return next;
}

function nextOccurrence(
  value: Date,
  repeatPeriod: CalendarEventRepeatPeriod,
  timeZone: string | null | undefined,
): Date {
  const parts = zonedDateParts(value, timeZone);
  const localDate = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  );

  if (repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.daily)
    localDate.setUTCDate(localDate.getUTCDate() + DAILY_REPEAT_STEP_DAYS);
  if (repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.weekly)
    localDate.setUTCDate(localDate.getUTCDate() + WEEKLY_REPEAT_STEP_DAYS);
  if (repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.monthly)
    localDate.setUTCMonth(localDate.getUTCMonth() + MONTHLY_REPEAT_STEP_MONTHS);
  if (repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.yearly)
    localDate.setUTCFullYear(localDate.getUTCFullYear() + YEARLY_REPEAT_STEP_YEARS);

  return zonedDateTimeToUtc(
    {
      year: localDate.getUTCFullYear(),
      month: localDate.getUTCMonth() + 1,
      day: localDate.getUTCDate(),
      hour: localDate.getUTCHours(),
      minute: localDate.getUTCMinutes(),
      second: localDate.getUTCSeconds(),
    },
    timeZone,
  );
}

function timeZoneOffsetMs(value: Date, timeZone: string | null | undefined): number {
  const parts = zonedDateParts(value, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - value.getTime();
}

function overlaps(start: Date, end: Date | null, rangeStart: Date, rangeEnd: Date): boolean {
  return start < rangeEnd && (end ?? start) >= rangeStart;
}

function isOccurrenceBeforeRangeEnd(
  occurrenceStart: Date,
  rangeEnd: Date,
  includeRangeEnd: boolean,
): boolean {
  return includeRangeEnd ? occurrenceStart <= rangeEnd : occurrenceStart < rangeEnd;
}
