import type { MetadataRoute } from 'next';
import { apiFetch } from '@/api/client';
import { serverEnv } from '@/env/server';

interface PublicSitemapPage {
  orgSlug: string;
  pageSlug: string;
  updatedAt: string;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const result = await apiFetch<PublicSitemapPage[]>('/public/pages');

  if (!result.ok) {
    return [
      {
        url: serverEnv.NEXT_PUBLIC_WEB_URL,
        lastModified: new Date(),
      },
    ];
  }

  return [
    {
      url: serverEnv.NEXT_PUBLIC_WEB_URL,
      lastModified: new Date(),
    },
    ...result.data.map((page) => ({
      url:
        page.pageSlug === 'home'
          ? `${serverEnv.NEXT_PUBLIC_WEB_URL}/o/${page.orgSlug}`
          : `${serverEnv.NEXT_PUBLIC_WEB_URL}/o/${page.orgSlug}/${page.pageSlug}`,
      lastModified: new Date(page.updatedAt),
    })),
  ];
}
