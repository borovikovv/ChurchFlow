import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { apiFetch } from '@/api/client';
import { requirePlatformAdmin } from '@/auth/session';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  description: string | null;
  archivedAt: string | null;
  suspendedAt: string | null;
  deletedAt: string | null;
}

async function organizationAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const action = String(formData.get('action'));
  const result = await apiFetch(`/admin/organizations/${id}/${action}`, { method: 'POST' });
  revalidatePath(`/admin/organizations/${id}`);
  const params = result.ok
    ? new URLSearchParams({ message: 'Organization status updated.' })
    : new URLSearchParams({ error: result.error.message });
  redirect(`/admin/organizations/${id}?${params.toString()}` as Route);
}

export default async function AdminOrganizationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { id } = await params;
  const { message, error } = await searchParams;
  await requirePlatformAdmin(`/admin/organizations/${id}`);

  const result = await apiFetch<OrganizationDetail>(`/admin/organizations/${id}`);

  if (!result.ok) {
    return <main className="page-content form-error">{result.error.message}</main>;
  }

  const organization = result.data;

  return (
    <main className="page-content stack">
      <PageHeader
        title={organization.name}
        description={`Manage lifecycle and inspect tenant details for ${organization.slug}.`}
        actions={
          <ButtonLink href="/admin/organizations" variant="secondary">
            Back to organizations
          </ButtonLink>
        }
      />
      <div className="stack">
        {message ? <p>{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        <dl className="details">
          <dt>Slug</dt>
          <dd>{organization.slug}</dd>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={organization.status} />
          </dd>
          <dt>Description</dt>
          <dd>{organization.description ?? 'No description'}</dd>
        </dl>
        <form className="actions" action={organizationAction}>
          <input type="hidden" name="id" value={organization.id} />
          {organization.status !== 'ACTIVE' ? (
            <ConfirmSubmitButton
              confirmLabel="Restore organization"
              description={`Restore ${organization.name} to active status and re-enable tenant access.`}
              name="action"
              title="Restore organization?"
              triggerLabel="Restore"
              value="restore"
              variant="primary"
            />
          ) : null}
          {organization.status !== 'SUSPENDED' && organization.status !== 'DELETED' ? (
            <ConfirmSubmitButton
              confirmLabel="Suspend organization"
              description={`Members of ${organization.name} will lose tenant access until the organization is restored.`}
              name="action"
              title="Suspend organization?"
              triggerLabel="Suspend"
              value="suspend"
            />
          ) : null}
          {organization.status !== 'ARCHIVED' && organization.status !== 'DELETED' ? (
            <ConfirmSubmitButton
              confirmLabel="Archive organization"
              description={`Archive ${organization.name}. Its data will be retained and the organization can be restored later.`}
              name="action"
              title="Archive organization?"
              triggerLabel="Archive"
              value="archive"
            />
          ) : null}
          {organization.status !== 'DELETED' ? (
            <ConfirmSubmitButton
              confirmLabel="Soft delete organization"
              confirmVariant="danger"
              description={`Soft delete ${organization.name}. Tenant access will be blocked, but its data will remain stored.`}
              name="action"
              title="Soft delete organization?"
              triggerLabel="Soft delete"
              value="delete-soft"
              variant="danger"
            />
          ) : null}
        </form>
      </div>
    </main>
  );
}
