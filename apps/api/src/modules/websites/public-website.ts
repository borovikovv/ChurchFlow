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
  locale: WebsiteSettings['locale'];
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

export interface PublicWebsiteTheme {
  accent: WebsiteTheme['accent'];
  background: WebsiteTheme['background'];
}

export interface PublicWebsite {
  id: string;
  title: string;
  description: string | null;
  publishedAt: Date | null;
  theme: PublicWebsiteTheme;
  settings: PublicWebsiteSettings;
  organization: { name: string; slug: string; logoUrl: string | null };
}

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
  const theme = normalizeWebsiteTheme(website.theme);

  return {
    id: website.id,
    title: website.title,
    description: website.description,
    publishedAt: website.publishedAt,
    theme: { accent: theme.accent, background: theme.background },
    settings: {
      template: settings.template,
      timeZone: settings.timeZone,
      locale: settings.locale,
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
    organization: {
      name: website.organization.name,
      slug: website.organization.slug,
      logoUrl: null,
    },
  };
}

export type ReadAssetUrl = (
  assetId: string | null,
  organizationId: string,
) => Promise<string | null>;

export interface StoredSeo {
  title: string | null;
  description: string | null;
  noindex: boolean;
  ogImageAssetId: string | null;
}

export function readSeo(seo: unknown): StoredSeo {
  const record = typeof seo === 'object' && seo !== null ? (seo as Record<string, unknown>) : {};

  return {
    title: readContentText(record, 'title') ?? null,
    description: readContentText(record, 'description') ?? null,
    noindex: record['noindex'] === true,
    ogImageAssetId: readContentText(record, 'ogImageAssetId') ?? null,
  };
}

interface StoredPage {
  organizationId: string;
  seo: unknown;
  sections: Array<{ content: unknown }>;
}

// A dashboard page keeps the stored seo record and adds the signed url of its OG image, so the
// editor can preview it without a second request.
export async function toDashboardPage<TPage extends StoredPage>(
  page: TPage,
  readUrl: ReadAssetUrl,
): Promise<TPage & { seo: Record<string, unknown> & { ogImageUrl: string | null } }> {
  const stored = typeof page.seo === 'object' && page.seo !== null ? page.seo : {};
  const [enriched, ogImageUrl] = await Promise.all([
    enrichSectionBackgrounds(page, readUrl),
    readUrl(readSeo(page.seo).ogImageAssetId, page.organizationId),
  ]);

  return { ...enriched, seo: { ...stored, ogImageUrl } };
}

export async function enrichSectionBackgrounds<TPage extends StoredPage>(
  page: TPage,
  readUrl: ReadAssetUrl,
): Promise<TPage> {
  const assetIds = new Set<string>();
  page.sections.forEach((section) => {
    const assetId = readContentText(section.content, 'backgroundImageAssetId');
    if (assetId) assetIds.add(assetId);
  });

  if (assetIds.size === 0) {
    return page;
  }

  const urls = new Map<string, string>();
  await Promise.all(
    [...assetIds].map(async (assetId) => {
      // Missing background assets should not hide otherwise published page content.
      const url = await readUrl(assetId, page.organizationId);
      if (url) urls.set(assetId, url);
    }),
  );

  return {
    ...page,
    sections: page.sections.map((section) => {
      const assetId = readContentText(section.content, 'backgroundImageAssetId');
      if (!assetId || !urls.has(assetId)) return section;

      return {
        ...section,
        content:
          typeof section.content === 'object' && section.content !== null
            ? { ...section.content, backgroundImageUrl: urls.get(assetId) }
            : section.content,
      };
    }),
  };
}

function readContentText(content: unknown, key: string): string | undefined {
  if (typeof content !== 'object' || content === null) return undefined;
  const value = (content as Record<string, unknown>)[key];

  return typeof value === 'string' && value.trim() ? value : undefined;
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
