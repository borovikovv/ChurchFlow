import type { WebsiteSection } from '@churchflow/shared';

export type PublicSection = Pick<WebsiteSection, 'id' | 'type' | 'order' | 'content'>;

export interface PublicWebsiteSummary {
  title: string;
  description: string | null;
  theme?: Record<string, unknown> | undefined;
  settings?: Record<string, unknown> | undefined;
  organization?: {
    name: string;
    slug: string;
  };
}

export function readText(content: Record<string, unknown>, key: string, fallback = ''): string {
  const value = content[key];
  return typeof value === 'string' ? value : fallback;
}
