import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { SectionRenderer } from '@/components/sections/section-renderer';
import {
  publicPageMetadata,
  websiteToFallbackPage,
  type PublicPageResponse,
  type PublicWebsiteResponse,
} from '../_lib/public-website';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;
  const page = await loadOrganizationHomePage(orgSlug);

  return publicPageMetadata({
    page,
    orgSlug,
  });
}

export default async function OrganizationLandingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const page = await loadOrganizationHomePage(orgSlug);

  if (!page) {
    notFound();
  }

  return (
    <main>
      <SectionRenderer sections={page.sections} website={page.website} />
    </main>
  );
}

async function loadOrganizationHomePage(orgSlug: string): Promise<PublicPageResponse | null> {
  const pageResult = await apiFetch<PublicPageResponse>(`/public/o/${orgSlug}/pages/home`);
  if (pageResult.ok && pageResult.data) {
    return pageResult.data;
  }

  const websiteResult = await apiFetch<PublicWebsiteResponse>(`/public/o/${orgSlug}`);
  if (websiteResult.ok && websiteResult.data) {
    return websiteToFallbackPage(websiteResult.data);
  }

  return null;
}
