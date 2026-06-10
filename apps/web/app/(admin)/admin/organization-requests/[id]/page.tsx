import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/api/client';

interface OrganizationRequestDetail {
  id: string;
  organizationName: string;
  organizationSlug: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  message: string | null;
  status: string;
  rejectionReason: string | null;
}

async function approveRequest(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  await apiFetch(`/admin/organization-requests/${id}/approve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      organizationName: formData.get('organizationName') || undefined,
      organizationSlug: formData.get('organizationSlug') || undefined
    })
  });
  revalidatePath(`/admin/organization-requests/${id}`);
}

async function rejectRequest(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  await apiFetch(`/admin/organization-requests/${id}/reject`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rejectionReason: formData.get('rejectionReason') })
  });
  revalidatePath(`/admin/organization-requests/${id}`);
}

export default async function AdminOrganizationRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await apiFetch<OrganizationRequestDetail>(`/admin/organization-requests/${id}`);

  if (!result.ok) {
    return <main className="section shell">Request not found.</main>;
  }

  const request = result.data;

  return (
    <main className="section">
      <div className="shell stack">
        <h1>{request.organizationName}</h1>
        <dl className="details">
          <dt>Status</dt>
          <dd>{request.status}</dd>
          <dt>Contact</dt>
          <dd>
            {request.contactName} · {request.contactEmail}
          </dd>
          <dt>Phone</dt>
          <dd>{request.contactPhone ?? 'Not provided'}</dd>
          <dt>Message</dt>
          <dd>{request.message ?? 'No message'}</dd>
        </dl>
        <form className="form-grid" action={approveRequest}>
          <input type="hidden" name="id" value={request.id} />
          <label>
            Organization name
            <input name="organizationName" defaultValue={request.organizationName} />
          </label>
          <label>
            Slug
            <input name="organizationSlug" defaultValue={request.organizationSlug ?? ''} />
          </label>
          <button className="button" type="submit">
            Approve
          </button>
        </form>
        <form className="form-grid" action={rejectRequest}>
          <input type="hidden" name="id" value={request.id} />
          <label>
            Rejection reason
            <textarea name="rejectionReason" required rows={4} defaultValue={request.rejectionReason ?? ''} />
          </label>
          <button className="button secondary" type="submit">
            Reject
          </button>
        </form>
      </div>
    </main>
  );
}
