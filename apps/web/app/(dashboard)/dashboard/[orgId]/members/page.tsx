import { apiFetch } from '@/api/client';

export default async function MembersDashboardPage({
  params
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const members = await apiFetch<unknown>(`/organizations/${orgId}/memberships`);

  return (
    <div className="stack">
      <h1>Members</h1>
      <p>Private CRM and member administration stays behind authenticated tenant authorization.</p>
      <pre>{JSON.stringify(members, null, 2)}</pre>
    </div>
  );
}
