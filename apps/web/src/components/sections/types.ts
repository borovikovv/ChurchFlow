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

export function readTheme(theme: Record<string, unknown>, key: string, fallback: string): string {
  const value = theme[key];

  return typeof value === 'string' && value.trim() ? value : fallback;
}
