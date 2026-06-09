import type { WebsiteSection } from '@churchflow/shared';

export type PublicSection = Pick<WebsiteSection, 'id' | 'type' | 'order' | 'content'>;

export function readText(content: Record<string, unknown>, key: string, fallback = ''): string {
  const value = content[key];
  return typeof value === 'string' ? value : fallback;
}
