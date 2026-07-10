import type { WebsitePage } from '@churchflow/shared';
import type { JsonRecord } from './types';
import { sectionPreset } from './website-section-presets';

export const PAGE_STATUSES: Array<WebsitePage['status']> = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

export function websiteSettingsInput(formData: FormData) {
  return {
    title: String(formData.get('title') ?? ''),
    description: optionalString(formData.get('description')),
    theme: {
      accent: optionalString(formData.get('accent')) ?? '#1f883d',
      background: optionalString(formData.get('background')) ?? '#ffffff',
    },
    settings: {
      template: optionalString(formData.get('template')) ?? 'default',
    },
  };
}

export function pageInput(formData: FormData) {
  const seo: JsonRecord = {};
  const seoTitle = optionalString(formData.get('seoTitle'));
  const seoDescription = optionalString(formData.get('seoDescription'));
  if (seoTitle) seo['title'] = seoTitle;
  if (seoDescription) seo['description'] = seoDescription;

  return {
    slug: String(formData.get('slug') ?? ''),
    title: String(formData.get('title') ?? ''),
    status: String(formData.get('status') ?? 'DRAFT') as WebsitePage['status'],
    seo,
  };
}

export function sectionInput(formData: FormData) {
  const preset = sectionPreset(String(formData.get('preset') ?? 'hero'));
  const title = optionalString(formData.get('title'));
  const body = optionalString(formData.get('body'));
  const content: JsonRecord = { variant: preset.variant };

  if (preset.type === 'hero') {
    if (title) content['headline'] = title;
    if (body) content['subheading'] = body;
  } else {
    if (title) content['title'] = title;
    if (body) content['body'] = body;
  }

  for (const key of ['address', 'email', 'phone']) {
    const value = optionalString(formData.get(key));
    if (value) content[key] = value;
  }
  for (const key of [
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
  ]) {
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
  if (items.length > 0) {
    content['items'] = items;
  }

  return {
    type: preset.type,
    order: Number(formData.get('order') ?? 0),
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

export function optionalString(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';

  return text || undefined;
}

export function readString(record: JsonRecord, key: string, fallback = ''): string {
  const value = record[key];

  return typeof value === 'string' ? value : fallback;
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
