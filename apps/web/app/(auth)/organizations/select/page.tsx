import { redirect } from 'next/navigation';
import { getPostLoginRedirect, requireServerSession } from '@/auth/session';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { getOrganizationAccessState } from '@/features/organizations/server/access';
import { organizationHomeRoute } from '@/features/organizations/routes';

export default async function OrganizationSelectPage() {
  await requireServerSession('/organizations/select');

  const access = await getOrganizationAccessState();

  if (access.organizations.length < 2) {
    redirect(await getPostLoginRedirect());
  }

  return (
    <main className="page-content stack">
      <PageHeader
        title="Choose an organization"
        description="Open the organization workspace you want to use."
      />

      <div className="grid gap-3">
        {access.organizations.map((organization) => (
          <article
            className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            key={organization.id}
          >
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 text-base font-semibold">{organization.name}</h2>
                <StatusBadge status={organization.role} />
                <StatusBadge status={organization.status} />
              </div>
              <p className="text-sm text-[var(--muted)]">{organization.slug}</p>
            </div>

            <ButtonLink href={organizationHomeRoute(organization.id)}>Open</ButtonLink>
          </article>
        ))}
      </div>
    </main>
  );
}
