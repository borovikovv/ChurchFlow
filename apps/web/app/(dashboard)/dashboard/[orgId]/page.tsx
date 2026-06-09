export default async function OrganizationDashboardPage({
  params
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  return (
    <div className="stack">
      <h1>Organization overview</h1>
      <p>Tenant administration placeholder for organization {orgId}.</p>
    </div>
  );
}
