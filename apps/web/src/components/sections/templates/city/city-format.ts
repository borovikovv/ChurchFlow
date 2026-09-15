import type { AppLocale } from '@churchflow/shared';
import type { PublicNextService, PublicWebsiteSummary } from '../../types';

export const CITY_INK = '#0a0a0a';
const CITY_WHITE = '#ffffff';

export interface CityTheme {
  accent: string;
  onAccent: string;
  // The accent as it may be used on white: a near-white accent falls back to ink.
  accentInk: string;
  onAccentInk: string;
}

export function cityTheme(website: PublicWebsiteSummary | undefined): CityTheme {
  const stored = website?.theme?.['accent'];
  const accent = typeof stored === 'string' && stored.trim() ? stored : CITY_WHITE;
  const accentInk = luminance(accent) > 0.8 ? CITY_INK : accent;

  return {
    accent,
    onAccent: luminance(accent) > 0.5 ? CITY_INK : CITY_WHITE,
    accentInk,
    onAccentInk: luminance(accentInk) > 0.5 ? CITY_INK : CITY_WHITE,
  };
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const digits = value.length === 3 ? [...value].map((char) => char + char).join('') : value;
  const channel = (offset: number) => parseInt(digits.slice(offset, offset + 2), 16) / 255;

  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

const CITY_MESSAGES = {
  en: {
    menu: 'Menu',
    address: 'Address',
    services: 'Services',
    nextService: 'Next service',
    liveNow: 'Live now',
    nextStream: 'Next stream',
    watch: 'Watch',
    socialLinks: 'Social links',
  },
  uk: {
    menu: 'Меню',
    address: 'Адреса',
    services: 'Служіння',
    nextService: 'Наступне служіння',
    liveNow: 'Зараз наживо',
    nextStream: 'Наступний ефір',
    watch: 'Дивитися',
    socialLinks: 'Соцмережі',
  },
} satisfies Record<AppLocale, Record<string, string>>;

export type CityMessages = (typeof CITY_MESSAGES)[AppLocale];

export function cityMessages(website: PublicWebsiteSummary | undefined): CityMessages {
  return CITY_MESSAGES[website?.settings?.locale ?? 'en'];
}

const WEEKDAY_ANCHOR = new Date('2026-09-13T00:00:00Z'); // a Sunday

// Service times are weekday + HH:mm; format them like a date on the matching weekday.
export function formatServiceTime(
  service: { weekday: number; time: string },
  locale: AppLocale,
): string {
  const date = new Date(WEEKDAY_ANCHOR);
  date.setUTCDate(date.getUTCDate() + service.weekday);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    date,
  );

  return `${capitalize(weekday)} · ${service.time}`;
}

export function formatNextService(
  nextService: PublicNextService,
  website: PublicWebsiteSummary | undefined,
): string {
  const locale = website?.settings?.locale ?? 'en';
  const timeZone = website?.settings?.timeZone ?? 'UTC';
  const formatted = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(nextService.startsAt));

  return capitalize(formatted);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
