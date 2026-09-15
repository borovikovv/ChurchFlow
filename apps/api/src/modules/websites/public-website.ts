import {
  publicWebsiteSectionKeys,
  websiteSettingsSchema,
  websiteThemeSchema,
  type WebsiteSection,
  type WebsiteSettings,
  type WebsiteTheme,
} from '@churchflow/shared';
import { computeLiveState, type WebsiteLiveState } from './live-state';

interface StoredWebsite {
  id: string;
  title: string;
  description: string | null;
  theme: unknown;
  settings: unknown;
  publishedAt: Date | null;
  organization: { name: string; slug: string };
}

export interface PublicWebsiteSettings {
  template: WebsiteSettings['template'];
  timeZone: string;
  navigation: WebsiteSettings['navigation'];
  serviceTimes: WebsiteSettings['serviceTimes'];
  location: WebsiteSettings['location'];
  socials: WebsiteSettings['socials'];
  seo: {
    title: string | null;
    description: string | null;
    noindex: boolean;
    ogImageAssetId: string | null;
    ogImageUrl: string | null;
  };
  live: { url: string | null } & WebsiteLiveState;
}

export interface PublicWebsite {
  id: string;
  title: string;
  description: string | null;
  publishedAt: Date | null;
  theme: WebsiteTheme;
  settings: PublicWebsiteSettings;
  organization: { name: string; slug: string };
}

// Stored JSON predates the typed schemas, so every read normalizes it: missing keys get their
// defaults and anything the schema does not know is dropped from what leaves the API.
export function normalizeWebsiteSettings(settings: unknown): WebsiteSettings {
  const result = websiteSettingsSchema.safeParse(settings ?? {});

  return result.success ? result.data : websiteSettingsSchema.parse({});
}

export function normalizeWebsiteTheme(theme: unknown): WebsiteTheme {
  const result = websiteThemeSchema.safeParse(theme ?? {});

  return result.success ? result.data : websiteThemeSchema.parse({});
}

export function toPublicWebsite(website: StoredWebsite, now = new Date()): PublicWebsite {
  const settings = normalizeWebsiteSettings(website.settings);

  return {
    id: website.id,
    title: website.title,
    description: website.description,
    publishedAt: website.publishedAt,
    theme: normalizeWebsiteTheme(website.theme),
    settings: {
      template: settings.template,
      timeZone: settings.timeZone,
      navigation: settings.navigation,
      serviceTimes: settings.serviceTimes,
      location: settings.location,
      socials: settings.socials,
      seo: {
        title: settings.seo.title ?? null,
        description: settings.seo.description ?? null,
        noindex: settings.seo.noindex,
        ogImageAssetId: settings.seo.ogImageAssetId ?? null,
        ogImageUrl: null,
      },
      live: { url: settings.live.url ?? null, ...computeLiveState(settings, now) },
    },
    organization: { name: website.organization.name, slug: website.organization.slug },
  };
}

export interface PublicSection {
  id: string;
  type: WebsiteSection['type'];
  order: number;
  content: Record<string, unknown>;
}

export function toPublicSection(section: {
  id: string;
  type: WebsiteSection['type'];
  order: number;
  content: unknown;
}): PublicSection {
  const stored =
    typeof section.content === 'object' && section.content !== null
      ? (section.content as Record<string, unknown>)
      : {};
  const content: Record<string, unknown> = {};

  for (const key of publicWebsiteSectionKeys(section.type)) {
    if (stored[key] !== undefined) content[key] = stored[key];
  }

  return { id: section.id, type: section.type, order: section.order, content };
}
