import { apiFetch } from '@/api/client';

export default async function WebsiteDashboardPage({
  params
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const website = await apiFetch<unknown>(`/organizations/${orgId}/website`);

  return (
    <div className="stack">
      <h1>Website</h1>
      <p>Manage website settings, pages, sections, publishing, and future custom domains.</p>
      <pre>{JSON.stringify(website, null, 2)}</pre>
    </div>
  );
}
