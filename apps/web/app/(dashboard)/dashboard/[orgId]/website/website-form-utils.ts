import {
  APP_LOCALES,
  DEFAULT_APP_LOCALE,
  PUBLIC_SECTION_TYPES,
  WEBSITE_LIVE_MODES,
  WEBSITE_NAVIGATION_MAX_LINKS,
  WEBSITE_PAGE_PRESETS,
  type AppLocale,
  type UpdateWebsiteSettingsPayload,
  type UpsertWebsitePagePayload,
  type UpsertWebsiteSectionPayload,
  type WebsiteLink,
  type WebsitePage,
  type WebsitePagePreset,
  type WebsiteServiceTime,
} from '@churchflow/shared';
import type { RepeaterRow } from '@/components/forms/form-repeater';
import type { DashboardWebsite, JsonRecord } from './types';
import type { SectionType } from './website-section-presets';

type WebsiteSeoPayload = NonNullable<NonNullable<UpdateWebsiteSettingsPayload['settings']>['seo']>;

export const PAGE_STATUSES: Array<WebsitePage['status']> = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

const WEEKDAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const SERVICE_TIME_DEFAULT_DURATION = 90;
const SERVICE_TIME_MIN_DURATION = 15;
const SERVICE_TIME_MAX_DURATION = 360;

// The structured editors post one value per row and field, so every field name arrives as its own
// parallel list and a row is the same index taken out of each list. Unlike the line format these
// fields used to carry, this keeps a value that contains a separator, a quote or a newline intact.
export const NAVIGATION_ROW_NAMES = { href: 'navigationHref', label: 'navigationLabel' } as const;
export const FOOTER_LINK_ROW_NAMES = { href: 'linkHref', label: 'linkLabel' } as const;
export const GIVING_WAY_ROW_NAMES = { label: 'wayLabel', value: 'wayValue' } as const;
export const SECTION_ITEM_ROW_NAMES = {
  body: 'itemBody',
  href: 'itemHref',
  label: 'itemLabel',
  title: 'itemTitle',
} as const;
export const SERVICE_TIME_ROW_NAMES = {
  durationMinutes: 'serviceTimeDuration',
  label: 'serviceTimeLabel',
  time: 'serviceTimeTime',
  weekday: 'serviceTimeWeekday',
} as const;

type LinkRowNames = { href: string; label: string };

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
      navigation: linksInput(formData, NAVIGATION_ROW_NAMES, 'navigation'),
      serviceTimes: serviceTimesInput(formData),
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
  const preset = pagePreset(optionalString(formData.get('preset')));

  return {
    slug: String(formData.get('slug') ?? ''),
    title: String(formData.get('title') ?? ''),
    status: String(formData.get('status') ?? 'DRAFT') as WebsitePage['status'],
    seo: seoInput(formData),
    ...(preset ? { preset } : {}),
  };
}

export type NavigationAppendResult =
  | { status: 'skipped' }
  | { status: 'menu-full' }
  | { status: 'ready'; settings: UpdateWebsiteSettingsPayload };

// The menu lives in the website settings, so adding a page to it is a settings patch. The patch
// replaces the title and description, so it is built from the stored website that the action reads
// back rather than from anything the editor sends.
export function navigationAppendInput(
  website: DashboardWebsite,
  page: { slug: string; title: string },
): NavigationAppendResult {
  const navigation = website.settings.navigation;
  const href = `/${page.slug}`;
  if (navigation.some((link) => link.href === href)) return { status: 'skipped' };
  if (navigation.length >= WEBSITE_NAVIGATION_MAX_LINKS) return { status: 'menu-full' };

  return {
    status: 'ready',
    settings: {
      title: website.title,
      description: website.description ?? undefined,
      settings: { navigation: [...navigation, { label: page.title, href }] },
    },
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

  // The alt text describes the background image, so removing the image drops it too.
  if (formData.get('removeBackgroundImage') !== 'true') {
    const backgroundImageAssetId = optionalString(formData.get('backgroundImageAssetId'));
    const backgroundImageUrl = optionalString(formData.get('backgroundImageUrl'));
    const backgroundImageAlt = optionalString(formData.get('backgroundImageAlt'));
    if (backgroundImageAssetId) content['backgroundImageAssetId'] = backgroundImageAssetId;
    if (backgroundImageUrl) content['backgroundImageUrl'] = backgroundImageUrl;
    if (backgroundImageAlt) content['backgroundImageAlt'] = backgroundImageAlt;
  }

  const items = itemsInput(formData);
  if (items.length > 0) content['items'] = items;

  const ways = waysInput(formData);
  if (ways.length > 0) content['ways'] = ways;

  const links = linksInput(formData, FOOTER_LINK_ROW_NAMES, 'links');
  if (links.length > 0) content['links'] = links;

  return {
    type,
    order: Number(formData.get('order') ?? 0),
    hidden: formData.get('hidden') === 'true',
    content,
  };
}

// Rows are built from the stored value rather than from a formatted line, so an entry the line
// format could not describe (a label holding a separator, a link with no label) still loads.
export function linkRows(value: unknown): RepeaterRow[] {
  return jsonRecords(value).map((record) => ({
    label: readString(record, 'label'),
    href: readString(record, 'href'),
  }));
}

export function wayRows(value: unknown): RepeaterRow[] {
  return jsonRecords(value).map((record) => ({
    label: readString(record, 'label'),
    value: readString(record, 'value'),
  }));
}

export function itemRows(value: unknown): RepeaterRow[] {
  return jsonRecords(value).map((record) => ({
    title: readString(record, 'title'),
    body: readString(record, 'body'),
    label: readString(record, 'label'),
    href: readString(record, 'href'),
  }));
}

export function serviceTimeRows(value: unknown): RepeaterRow[] {
  return jsonRecords(value).map((record) => ({
    weekday: String(readNumber(record, 'weekday', 0)),
    time: readString(record, 'time'),
    durationMinutes: String(readNumber(record, 'durationMinutes', SERVICE_TIME_DEFAULT_DURATION)),
    label: readString(record, 'label'),
  }));
}

// One entry per submitted row, holding the values of the given field names in that order.
export function repeaterRows(formData: FormData, names: readonly string[]): string[][] {
  const columns = names.map((name) => formData.getAll(name).map(entryText));
  const rowCount = Math.max(0, ...columns.map((column) => column.length));

  return Array.from({ length: rowCount }, (_, index) =>
    columns.map((column) => column[index] ?? ''),
  );
}

// The weekday, time and duration inputs constrain themselves in the browser, so a row that still
// arrives broken was not typed in the editor and is dropped rather than stored half-valid.
export function serviceTimeRow(row: {
  durationMinutes: string;
  label: string;
  time: string;
  weekday: string;
}): WebsiteServiceTime | null {
  const weekday = Number(row.weekday);
  const durationMinutes = Number(row.durationMinutes);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
  if (!TIME_PATTERN.test(row.time)) return null;
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < SERVICE_TIME_MIN_DURATION ||
    durationMinutes > SERVICE_TIME_MAX_DURATION
  ) {
    return null;
  }

  return {
    weekday,
    time: row.time,
    durationMinutes,
    ...(row.label ? { label: row.label } : {}),
  };
}

// The line format stays the fallback for a form that still posts a single text field.
function linksInput(formData: FormData, names: LinkRowNames, legacyKey: string): WebsiteLink[] {
  const rows = repeaterRows(formData, [names.label, names.href]);
  if (rows.length === 0) return parseLinks(optionalString(formData.get(legacyKey)));

  return rows
    .map(([label = '', href = '']) => ({ label, href }))
    .filter((link) => link.label && link.href);
}

function waysInput(formData: FormData): Array<{ label: string; value: string }> {
  const rows = repeaterRows(formData, [GIVING_WAY_ROW_NAMES.label, GIVING_WAY_ROW_NAMES.value]);
  if (rows.length === 0) return parseWays(optionalString(formData.get('ways')));

  return rows
    .map(([label = '', value = '']) => ({ label, value }))
    .filter((way) => way.label && way.value);
}

function itemsInput(formData: FormData) {
  const rows = repeaterRows(formData, [
    SECTION_ITEM_ROW_NAMES.title,
    SECTION_ITEM_ROW_NAMES.body,
    SECTION_ITEM_ROW_NAMES.label,
    SECTION_ITEM_ROW_NAMES.href,
  ]);
  if (rows.length === 0) return parseItems(optionalString(formData.get('items')));

  return rows
    .filter(([title = '']) => title)
    .map(([title = '', body = '', label = '', href = '']) => ({
      title,
      ...(body ? { body } : {}),
      ...(label ? { label } : {}),
      ...(href ? { href } : {}),
    }));
}

function serviceTimesInput(formData: FormData): WebsiteServiceTime[] {
  const rows = repeaterRows(formData, [
    SERVICE_TIME_ROW_NAMES.weekday,
    SERVICE_TIME_ROW_NAMES.time,
    SERVICE_TIME_ROW_NAMES.durationMinutes,
    SERVICE_TIME_ROW_NAMES.label,
  ]);
  if (rows.length === 0) return parseServiceTimes(optionalString(formData.get('serviceTimes')));

  return rows.flatMap(([weekday = '', time = '', durationMinutes = '', label = '']) => {
    const service = serviceTimeRow({ weekday, time, durationMinutes, label });

    return service ? [service] : [];
  });
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
    if (weekday === null || !TIME_PATTERN.test(time)) return [];

    return [
      {
        weekday,
        time,
        durationMinutes: Number(duration) || SERVICE_TIME_DEFAULT_DURATION,
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

function pagePreset(value: string | undefined): WebsitePagePreset | undefined {
  return WEBSITE_PAGE_PRESETS.find((preset) => preset === value);
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

function jsonRecords(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];

    return [{ ...entry }];
  });
}

function readNumber(record: JsonRecord, key: string, fallback: number): number {
  const value = record[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function entryText(value: FormDataEntryValue): string {
  return typeof value === 'string' ? value.trim() : '';
}
