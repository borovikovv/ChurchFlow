import type { WebsitePage, WebsiteSection } from '@churchflow/shared';

export type JsonRecord = Record<string, unknown>;

export interface DashboardWebsite {
  id: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  theme: JsonRecord;
  settings: JsonRecord;
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
  content: JsonRecord;
}

export interface WebsiteFeedback {
  error?: string | undefined;
  message?: string | undefined;
}
