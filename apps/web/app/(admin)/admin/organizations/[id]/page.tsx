import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/api/client';

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
  await apiFetch(`/admin/organizations/${id}/${action}`, { method: 'POST' });
  revalidatePath(`/admin/organizations/${id}`);
}

export default async function AdminOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await apiFetch<OrganizationDetail>(`/admin/organizations/${id}`);

  if (!result.ok) {
    return <main className="section shell">Organization not found.</main>;
  }

  const organization = result.data;

  return (
    <main className="section">
      <div className="shell stack">
        <h1>{organization.name}</h1>
        <dl className="details">
          <dt>Slug</dt>
          <dd>{organization.slug}</dd>
          <dt>Status</dt>
          <dd>{organization.status}</dd>
          <dt>Description</dt>
          <dd>{organization.description ?? 'No description'}</dd>
        </dl>
        <form className="actions" action={organizationAction}>
          <input type="hidden" name="id" value={organization.id} />
          <button className="button" name="action" value="restore" type="submit">
            Restore
          </button>
          <button className="button secondary" name="action" value="suspend" type="submit">
            Suspend
          </button>
          <button className="button secondary" name="action" value="archive" type="submit">
            Archive
          </button>
          <button className="button danger" name="action" value="delete-soft" type="submit">
            Soft delete
          </button>
        </form>
      </div>
    </main>
  );
}
