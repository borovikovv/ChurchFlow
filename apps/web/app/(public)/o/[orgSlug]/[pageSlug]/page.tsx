import { notFound } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { SectionRenderer, type PublicSection } from '@/components/sections/section-renderer';

interface PublicPageResponse {
  title: string;
  sections: PublicSection[];
}

export default async function OrganizationPublicPage({
  params
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
      <SectionRenderer sections={result.data.sections} />
    </main>
  );
}
