import type { WebsiteServiceTime, WebsiteSettings } from '@churchflow/shared';

const MINUTES_PER_WEEK = 7 * 24 * 60;
const MINUTES_PER_DAY = 24 * 60;

export interface WebsiteLiveState {
  isLive: boolean;
  nextService: { weekday: number; time: string; label: string | null; startsAt: string } | null;
}

export function computeLiveState(settings: WebsiteSettings, now = new Date()): WebsiteLiveState {
  const nowMinutes = weekMinutes(zonedParts(now, settings.timeZone));
  const nextService = nextServiceTime(settings.serviceTimes, settings.timeZone, now);

  if (settings.live.mode === 'manual') {
    return { isLive: settings.live.isLive, nextService };
  }

  const isLive = settings.serviceTimes.some((service) => {
    const start = serviceWeekMinutes(service);
    const sinceStart = (nowMinutes - start + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
    const untilStart = (start - nowMinutes + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;

    return sinceStart <= service.durationMinutes || untilStart <= settings.live.leadMinutes;
  });

  return { isLive, nextService };
}

function nextServiceTime(
  serviceTimes: WebsiteServiceTime[],
  timeZone: string,
  now: Date,
): WebsiteLiveState['nextService'] {
  const today = zonedParts(now, timeZone);
  let best: { service: WebsiteServiceTime; startsAt: Date } | null = null;

  for (const service of serviceTimes) {
    const [hour = 0, minute = 0] = service.time.split(':').map(Number);
    const daysAhead = (service.weekday - today.weekday + 7) % 7;

    // The previous occurrence can still be running when a service crosses midnight.
    for (const offset of [daysAhead - 7, daysAhead, daysAhead + 7]) {
      const day = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
      const startsAt = zonedToUtc(
        {
          year: day.getUTCFullYear(),
          month: day.getUTCMonth() + 1,
          day: day.getUTCDate(),
          hour,
          minute,
        },
        timeZone,
      );
      if (startsAt.getTime() + service.durationMinutes * 60_000 < now.getTime()) continue;
      if (!best || startsAt < best.startsAt) best = { service, startsAt };
      break;
    }
  }

  if (!best) return null;

  return {
    weekday: best.service.weekday,
    time: best.service.time,
    label: best.service.label ?? null,
    startsAt: best.startsAt.toISOString(),
  };
}

function serviceWeekMinutes(service: WebsiteServiceTime): number {
  const [hours = 0, minutes = 0] = service.time.split(':').map(Number);

  return service.weekday * MINUTES_PER_DAY + hours * 60 + minutes;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    hour: Number(read('hour')),
    minute: Number(read('minute')),
    weekday: Math.max(0, WEEKDAYS.indexOf(read('weekday'))),
  };
}

function weekMinutes(parts: ZonedParts): number {
  return parts.weekday * MINUTES_PER_DAY + parts.hour * 60 + parts.minute;
}

function zonedToUtc(local: Omit<ZonedParts, 'weekday'>, timeZone: string): Date {
  const wall = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  let guess = wall;
  for (let round = 0; round < 2; round += 1) {
    const seen = zonedParts(new Date(guess), timeZone);
    const seenWall = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    guess += wall - seenWall;
  }

  return new Date(guess);
}
