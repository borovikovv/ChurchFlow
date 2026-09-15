import type { WebsiteServiceTime, WebsiteSettings } from '@churchflow/shared';

const MINUTES_PER_WEEK = 7 * 24 * 60;

export interface WebsiteLiveState {
  isLive: boolean;
  nextService: { weekday: number; time: string; label: string | null; startsAt: string } | null;
}

// Service times are stored as local weekday + HH:mm; both they and `now` are projected onto
// "minutes since Sunday 00:00" in the website's time zone so the comparison ignores dates.
export function computeLiveState(settings: WebsiteSettings, now = new Date()): WebsiteLiveState {
  const nowMinutes = weekMinutesInTimeZone(now, settings.timeZone);
  const nextService = nextServiceTime(settings.serviceTimes, nowMinutes, now);

  if (settings.live.mode === 'manual') {
    return { isLive: settings.live.isLive, nextService };
  }

  const isLive = settings.serviceTimes.some((service) => {
    const start = weekMinutes(service);
    const sinceStart = (nowMinutes - start + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
    const untilStart = (start - nowMinutes + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;

    return sinceStart <= service.durationMinutes || untilStart <= settings.live.leadMinutes;
  });

  return { isLive, nextService };
}

function nextServiceTime(
  serviceTimes: WebsiteServiceTime[],
  nowMinutes: number,
  now: Date,
): WebsiteLiveState['nextService'] {
  let best: { service: WebsiteServiceTime; untilStart: number } | null = null;

  for (const service of serviceTimes) {
    const untilStart = (weekMinutes(service) - nowMinutes + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
    if (!best || untilStart < best.untilStart) {
      best = { service, untilStart };
    }
  }

  if (!best) return null;

  return {
    weekday: best.service.weekday,
    time: best.service.time,
    label: best.service.label ?? null,
    startsAt: new Date(now.getTime() + best.untilStart * 60_000).toISOString(),
  };
}

function weekMinutes(service: WebsiteServiceTime): number {
  const [hours = 0, minutes = 0] = service.time.split(':').map(Number);

  return service.weekday * 24 * 60 + hours * 60 + minutes;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekMinutesInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const weekday = Math.max(0, WEEKDAYS.indexOf(read('weekday')));

  return weekday * 24 * 60 + Number(read('hour')) * 60 + Number(read('minute'));
}
