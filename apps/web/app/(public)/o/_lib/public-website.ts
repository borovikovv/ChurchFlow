import type { Metadata } from 'next';
import { serverEnv } from '@/env/server';
import type { PublicSection, PublicWebsiteSummary } from '@/components/sections/section-renderer';

export interface PublicPageResponse {
  title: string;
  seo: Record<string, unknown>;
  sections: PublicSection[];
  website: PublicWebsiteSummary;
}

export interface PublicWebsiteResponse extends PublicWebsiteSummary {
  id: string;
  publishedAt: string | null;
  theme: Record<string, unknown>;
  settings: Record<string, unknown>;
  organization: {
    name: string;
    slug: string;
  };
}

export function websiteToFallbackPage(website: PublicWebsiteResponse): PublicPageResponse {
  return {
    title: website.title,
    seo: {},
    sections: [],
    website,
  };
}

export function publicPageMetadata({
  page,
  orgSlug,
  pageSlug,
}: {
  page: PublicPageResponse | null;
  orgSlug: string;
  pageSlug?: string | undefined;
}): Metadata {
  if (!page) {
    return {
      title: 'Page not found',
      robots: { index: false, follow: false },
    };
  }

  const title = readSeoText(page.seo, 'title') ?? `${page.title} | ${page.website.title}`;
  const description =
    readSeoText(page.seo, 'description') ?? page.website.description ?? page.website.title;
  const pathname = pageSlug ? `/o/${orgSlug}/${pageSlug}` : `/o/${orgSlug}`;
  const url = new URL(pathname, serverEnv.NEXT_PUBLIC_WEB_URL).toString();

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

function readSeoText(seo: Record<string, unknown>, key: string): string | undefined {
  const value = seo[key];

  return typeof value === 'string' && value.trim() ? value : undefined;
}
