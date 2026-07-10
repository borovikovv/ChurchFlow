import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { SectionRenderer } from '@/components/sections/section-renderer';
import { publicPageMetadata, type PublicPageResponse } from '../../_lib/public-website';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; pageSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug, pageSlug } = await params;
  const result = await apiFetch<PublicPageResponse>(`/public/o/${orgSlug}/pages/${pageSlug}`);

  return publicPageMetadata({
    page: result.ok ? result.data : null,
    orgSlug,
    pageSlug,
  });
}

export default async function OrganizationPublicPage({
  params,
}: {
  params: Promise<{ orgSlug: string; pageSlug: string }>;
}) {
  const { orgSlug, pageSlug } = await params;
  const result = await apiFetch<PublicPageResponse>(`/public/o/${orgSlug}/pages/${pageSlug}`);

  if (!result.ok || !result.data) {
    notFound();
  }

  return (
    <main>
      <SectionRenderer sections={result.data.sections} website={result.data.website} />
    </main>
  );
}
