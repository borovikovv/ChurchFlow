import type { WebsitePage, WebsiteSection } from '@churchflow/shared';
import type { JsonRecord } from './types';

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
  const type = String(formData.get('type') ?? 'hero') as WebsiteSection['type'];
  const title = optionalString(formData.get('title'));
  const body = optionalString(formData.get('body'));
  const content: JsonRecord = {};

  if (type === 'hero') {
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

  return {
    type,
    order: Number(formData.get('order') ?? 0),
    content,
  };
}

export function optionalString(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';

  return text || undefined;
}

export function readString(record: JsonRecord, key: string, fallback = ''): string {
  const value = record[key];

  return typeof value === 'string' ? value : fallback;
}
