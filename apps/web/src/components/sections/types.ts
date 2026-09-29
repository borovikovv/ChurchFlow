import type {
  AppLocale,
  WebsiteLink,
  WebsiteLocationSettings,
  WebsiteSection,
  WebsiteServiceTime,
  WebsiteSocialLinks,
  WebsiteTemplateId,
} from '@churchflow/shared';

export type PublicSection = Pick<WebsiteSection, 'id' | 'type' | 'order' | 'content'>;

export interface PublicNextService {
  weekday: number;
  time: string;
  label: string | null;
  startsAt: string;
}

export interface PublicWebsiteSettings {
  template: WebsiteTemplateId;
  timeZone: string;
  locale: AppLocale;
  navigation: WebsiteLink[];
  serviceTimes: WebsiteServiceTime[];
  location: WebsiteLocationSettings;
  socials: WebsiteSocialLinks;
  seo: {
    title: string | null;
    description: string | null;
    noindex: boolean;
    ogImageUrl: string | null;
  };
  live: {
    url: string | null;
    isLive: boolean;
    nextService: PublicNextService | null;
  };
}

export interface PublicWebsiteSummary {
  title: string;
  description: string | null;
  theme?: Record<string, unknown> | undefined;
  settings?: Partial<PublicWebsiteSettings> | undefined;
  organization?: {
    name: string;
    slug: string;
    logoUrl?: string | null | undefined;
  };
}

export function readText(content: Record<string, unknown>, key: string, fallback = ''): string {
  const value = content[key];
  return typeof value === 'string' ? value : fallback;
}

// The hero falls back to the website title and the footer carries no heading, so neither is listed.
type TitledSectionType = Exclude<PublicSection['type'], 'hero' | 'footer'>;

const SECTION_TITLES = {
  en: {
    about: 'About',
    schedule: 'Schedule',
    gallery: 'Gallery',
    contact: 'Contact',
    live: 'Live stream',
    giving: 'Giving',
  },
  uk: {
    about: 'Про нас',
    schedule: 'Розклад',
    gallery: 'Галерея',
    contact: 'Контакти',
    live: 'Трансляція',
    giving: 'Пожертви',
  },
} satisfies Record<AppLocale, Record<TitledSectionType, string>>;

/** The section's own title, or the default for its type so a visible section is never untitled. */
export function sectionTitle(
  content: Record<string, unknown>,
  type: TitledSectionType,
  website: PublicWebsiteSummary | undefined,
): string {
  const title = content['title'];
  if (typeof title === 'string' && title.trim()) return title;

  return SECTION_TITLES[website?.settings?.locale ?? 'en'][type];
}

export function readTheme(theme: Record<string, unknown>, key: string, fallback: string): string {
  const value = theme[key];

  return typeof value === 'string' && value.trim() ? value : fallback;
}
