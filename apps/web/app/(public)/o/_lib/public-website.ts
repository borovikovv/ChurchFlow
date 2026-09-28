import type { Metadata } from 'next';
import { serverEnv } from '@/env/server';
import type {
  PublicSection,
  PublicWebsiteSettings,
  PublicWebsiteSummary,
} from '@/components/sections/section-renderer';

export interface PublicPageSeo {
  title: string | null;
  description: string | null;
  noindex: boolean;
  ogImageUrl: string | null;
}

export interface PublicWebsiteResponse extends PublicWebsiteSummary {
  id: string;
  publishedAt: string | null;
  theme: Record<string, unknown>;
  settings: PublicWebsiteSettings;
  organization: {
    name: string;
    slug: string;
    logoUrl: string | null;
  };
}

export interface PublicPageResponse {
  title: string;
  seo: PublicPageSeo;
  sections: PublicSection[];
  website: PublicWebsiteResponse;
}

export function websiteToFallbackPage(website: PublicWebsiteResponse): PublicPageResponse {
  return {
    title: website.title,
    seo: { title: null, description: null, noindex: false, ogImageUrl: null },
    sections: [],
    website,
  };
}

export function publicPageUrl({
  orgSlug,
  pageSlug,
}: {
  orgSlug: string;
  pageSlug?: string | undefined;
}): string {
  const pathname = pageSlug ? `/o/${orgSlug}/${pageSlug}` : `/o/${orgSlug}`;

  return new URL(pathname, serverEnv.NEXT_PUBLIC_WEB_URL).toString();
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

  const websiteSeo = page.website.settings.seo;
  const title = page.seo.title ?? websiteSeo.title ?? `${page.title} | ${page.website.title}`;
  const description =
    page.seo.description ??
    websiteSeo.description ??
    page.website.description ??
    page.website.title;
  const url = publicPageUrl({ orgSlug, pageSlug });
  const image = page.seo.ogImageUrl ?? websiteSeo.ogImageUrl;
  const index = !page.seo.noindex && !websiteSeo.noindex;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: page.website.title,
      locale: page.website.settings.locale,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    robots: { index, follow: index },
  };
}
