import type {
  WebsitePage,
  WebsiteSection,
  WebsiteSettings,
  WebsiteTheme,
} from '@churchflow/shared';

export type JsonRecord = Record<string, unknown>;

export interface DashboardWebsiteSettings extends WebsiteSettings {
  seo: WebsiteSettings['seo'] & { ogImageUrl: string | null };
}

export interface DashboardWebsite {
  id: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  theme: WebsiteTheme;
  settings: DashboardWebsiteSettings;
  organization: {
    name: string;
    slug: string;
  };
}

export interface DashboardPage {
  id: string;
  slug: string;
  title: string;
  status: WebsitePage['status'];
  seo: JsonRecord;
  publishedAt: string | null;
  sections: DashboardSection[];
}

export interface DashboardSection {
  id: string;
  type: WebsiteSection['type'];
  order: number;
  hidden: boolean;
  content: JsonRecord;
}

export interface WebsiteFeedback {
  error?: string | undefined;
  message?: string | undefined;
}
