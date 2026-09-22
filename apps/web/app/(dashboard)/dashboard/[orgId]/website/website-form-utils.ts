import {
  APP_LOCALES,
  DEFAULT_APP_LOCALE,
  PUBLIC_SECTION_TYPES,
  WEBSITE_LIVE_MODES,
  type AppLocale,
  type UpdateWebsiteSettingsPayload,
  type UpsertWebsitePagePayload,
  type UpsertWebsiteSectionPayload,
  type WebsiteLink,
  type WebsitePage,
  type WebsiteServiceTime,
} from '@churchflow/shared';
import type { JsonRecord } from './types';
import type { SectionType } from './website-section-presets';

type WebsiteSeoPayload = NonNullable<NonNullable<UpdateWebsiteSettingsPayload['settings']>['seo']>;

export const PAGE_STATUSES: Array<WebsitePage['status']> = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

const WEEKDAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function websiteSettingsInput(formData: FormData): UpdateWebsiteSettingsPayload {
  return {
    title: String(formData.get('title') ?? ''),
    description: optionalString(formData.get('description')),
    theme: {
      accent: optionalString(formData.get('accent')) ?? '#1f883d',
      background: optionalString(formData.get('background')) ?? '#ffffff',
    },
    settings: {
      locale: appLocale(optionalString(formData.get('locale'))),
      timeZone: optionalString(formData.get('timeZone')) ?? 'UTC',
      navigation: parseLinks(optionalString(formData.get('navigation'))),
      serviceTimes: parseServiceTimes(optionalString(formData.get('serviceTimes'))),
      location: {
        address: optionalString(formData.get('address')),
        addressNote: optionalString(formData.get('addressNote')),
        directionsUrl: optionalString(formData.get('directionsUrl')),
      },
      live: {
        url: optionalString(formData.get('liveUrl')),
        mode: liveMode(optionalString(formData.get('liveMode'))),
        isLive: formData.get('isLive') === 'true',
        leadMinutes: Number(formData.get('leadMinutes') ?? 5) || 0,
      },
      socials: {
        facebook: optionalString(formData.get('facebook')),
        instagram: optionalString(formData.get('instagram')),
        youtube: optionalString(formData.get('youtube')),
        telegram: optionalString(formData.get('telegram')),
      },
      seo: seoInput(formData),
    },
  };
}

export function pageInput(formData: FormData): UpsertWebsitePagePayload {
  return {
    slug: String(formData.get('slug') ?? ''),
    title: String(formData.get('title') ?? ''),
    status: String(formData.get('status') ?? 'DRAFT') as WebsitePage['status'],
    seo: seoInput(formData),
  };
}

// The saved seo object replaces the stored one, so the current OG image id travels with the
// form in a hidden input and is only left out when its removal was requested.
function seoInput(formData: FormData): WebsiteSeoPayload {
  return {
    title: optionalString(formData.get('seoTitle')),
    description: optionalString(formData.get('seoDescription')),
    noindex: formData.get('noindex') === 'true',
    ogImageAssetId:
      formData.get('removeOgImage') === 'true'
        ? undefined
        : optionalString(formData.get('ogImageAssetId')),
  };
}

const SECTION_TEXT_KEYS = [
  'eyebrow',
  'address',
  'email',
  'phone',
  'primaryLabel',
  'primaryHref',
  'secondaryLabel',
  'secondaryHref',
  'copyright',
  'socialMetaHref',
  'socialInstagramHref',
  'socialTiktokHref',
  'socialXHref',
  'backgroundColor',
  'fontPreset',
  'liveLabel',
  'liveTitle',
  'scheduledTitle',
  'scheduledBody',
] as const;

export function sectionInput(formData: FormData): UpsertWebsiteSectionPayload {
  const type = sectionType(String(formData.get('type') ?? 'hero'));
  const variant = optionalString(formData.get('variant')) ?? type;
  const title = optionalString(formData.get('title'));
  const body = optionalString(formData.get('body'));
  const content: JsonRecord = { variant };

  if (type === 'hero') {
    if (title) content['headline'] = title;
    if (body) content['subheading'] = body;
  } else {
    if (title) content['title'] = title;
    if (body) content['body'] = body;
  }

  for (const key of SECTION_TEXT_KEYS) {
    const value = optionalString(formData.get(key));
    if (value) content[key] = value;
  }

  if (formData.get('removeBackgroundImage') !== 'true') {
    const backgroundImageAssetId = optionalString(formData.get('backgroundImageAssetId'));
    const backgroundImageUrl = optionalString(formData.get('backgroundImageUrl'));
    if (backgroundImageAssetId) content['backgroundImageAssetId'] = backgroundImageAssetId;
    if (backgroundImageUrl) content['backgroundImageUrl'] = backgroundImageUrl;
  }

  const items = parseItems(optionalString(formData.get('items')));
  if (items.length > 0) content['items'] = items;

  const ways = parseWays(optionalString(formData.get('ways')));
  if (ways.length > 0) content['ways'] = ways;

  const links = parseLinks(optionalString(formData.get('links')));
  if (links.length > 0) content['links'] = links;

  return {
    type,
    order: Number(formData.get('order') ?? 0),
    hidden: formData.get('hidden') === 'true',
    content,
  };
}

export function formatItems(value: unknown): string {
  if (!Array.isArray(value)) return '';

  return value
    .map((item) => {
      if (!isItemRecord(item)) return '';
      return [item.title, item.body, item.label, item.href]
        .map((part) => (typeof part === 'string' ? part : ''))
        .join(' | ')
        .replace(/(?:\s\|\s)*$/u, '');
    })
    .filter(Boolean)
    .join('\n');
}

export function formatLinks(value: unknown): string {
  if (!Array.isArray(value)) return '';

  return value
    .flatMap((link) => {
      if (typeof link !== 'object' || link === null) return [];
      const record = link as JsonRecord;
      return typeof record['label'] === 'string' && typeof record['href'] === 'string'
        ? [`${record['label']} | ${record['href']}`]
        : [];
    })
    .join('\n');
}

export function formatWays(value: unknown): string {
  if (!Array.isArray(value)) return '';

  return value
    .flatMap((way) => {
      if (typeof way !== 'object' || way === null) return [];
      const record = way as JsonRecord;
      return typeof record['label'] === 'string' && typeof record['value'] === 'string'
        ? [`${record['label']} | ${record['value']}`]
        : [];
    })
    .join('\n');
}

export function formatServiceTimes(value: unknown): string {
  if (!Array.isArray(value)) return '';

  return value
    .flatMap((service) => {
      if (typeof service !== 'object' || service === null) return [];
      const record = service as JsonRecord;
      if (typeof record['weekday'] !== 'number' || typeof record['time'] !== 'string') return [];
      const weekday = WEEKDAY_NAMES[record['weekday']] ?? String(record['weekday']);
      const duration =
        typeof record['durationMinutes'] === 'number' ? record['durationMinutes'] : 90;
      const label = typeof record['label'] === 'string' ? record['label'] : '';

      return [
        [`${weekday} ${record['time']}`, String(duration), label]
          .join(' | ')
          .replace(/(?:\s\|\s)*$/u, ''),
      ];
    })
    .join('\n');
}

export function parseLinks(value: string | undefined): WebsiteLink[] {
  if (!value) return [];

  return value
    .split(/\r?\n/u)
    .map((line) => {
      const [label = '', href = ''] = line.split('|').map((part) => part.trim());
      return { label, href };
    })
    .filter((link) => link.label && link.href);
}

export function parseWays(value: string | undefined): Array<{ label: string; value: string }> {
  if (!value) return [];

  return value
    .split(/\r?\n/u)
    .map((line) => {
      const [label = '', text = ''] = line.split('|').map((part) => part.trim());
      return { label, value: text };
    })
    .filter((way) => way.label && way.value);
}

export function parseServiceTimes(value: string | undefined): WebsiteServiceTime[] {
  if (!value) return [];

  return value.split(/\r?\n/u).flatMap((line) => {
    const [slot = '', duration = '', label = ''] = line.split('|').map((part) => part.trim());
    const [weekdayText = '', time = ''] = slot.split(/\s+/u);
    const weekday = parseWeekday(weekdayText);
    if (weekday === null || !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(time)) return [];

    return [
      {
        weekday,
        time,
        durationMinutes: Number(duration) || 90,
        ...(label ? { label } : {}),
      },
    ];
  });
}

function parseWeekday(value: string): number | null {
  const lower = value.toLowerCase();
  const index = WEEKDAY_NAMES.findIndex((name) => lower.startsWith(name));
  if (index >= 0) return index;

  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= 6 ? numeric : null;
}

export function optionalString(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';

  return text || undefined;
}

export function readString(record: JsonRecord, key: string, fallback = ''): string {
  const value = record[key];

  return typeof value === 'string' ? value : fallback;
}

function sectionType(value: string): SectionType {
  return PUBLIC_SECTION_TYPES.find((type) => type === value) ?? 'hero';
}

function appLocale(value: string | undefined): AppLocale {
  return APP_LOCALES.find((locale) => locale === value) ?? DEFAULT_APP_LOCALE;
}

function liveMode(value: string | undefined) {
  return WEBSITE_LIVE_MODES.find((mode) => mode === value) ?? 'schedule';
}

function parseItems(value: string | undefined) {
  if (!value) return [];

  return value
    .split(/\r?\n/u)
    .map((line) => {
      const [title, body, label, href] = line.split('|').map((part) => part.trim());
      return { title, body, label, href };
    })
    .filter((item) => item.title);
}

function isItemRecord(value: unknown): value is {
  body?: string;
  href?: string;
  label?: string;
  title?: string;
} {
  return typeof value === 'object' && value !== null;
}
