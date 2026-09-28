import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { SectionRenderer } from '@/components/sections/section-renderer';
import { requireOrganizationOwnerAccess } from '@/features/organizations/server/owner-access';
import type { PublicPageResponse } from '../../../_lib/public-website';

export const metadata: Metadata = {
  title: 'Preview',
  robots: { index: false, follow: false },
};

export default async function WebsitePreviewPage({
  params,
}: {
  params: Promise<{ orgId: string; pageId: string }>;
}) {
  const { orgId, pageId } = await params;
  await requireOrganizationOwnerAccess(orgId);

  const result = await apiFetch<PublicPageResponse>(
    `/organizations/${orgId}/pages/${pageId}/preview`,
  );

  if (!result.ok || !result.data) {
    notFound();
  }

  return (
    <main>
      <SectionRenderer sections={result.data.sections} website={result.data.website} />
    </main>
  );
}
