import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { apiFetch } from '@/api/client';
import { requirePlatformAdmin } from '@/auth/session';

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
  createdOrganization?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface ApproveOrganizationRequestResult {
  organization: {
    id: string;
  };
}

async function approveRequest(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const result = await apiFetch<ApproveOrganizationRequestResult>(`/admin/organization-requests/${id}/approve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      organizationName: formData.get('organizationName') || undefined,
      organizationSlug: formData.get('organizationSlug') || undefined
    })
  });
  revalidatePath(`/admin/organization-requests/${id}`);

  if (!result.ok) {
    redirect(`/admin/organization-requests/${id}?error=${encodeURIComponent(result.error.message)}` as Route);
  }

  redirect(
    `/admin/organization-requests/${id}?approved=1&createdOrganizationId=${encodeURIComponent(result.data.organization.id)}` as Route
  );
}

async function rejectRequest(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const result = await apiFetch(`/admin/organization-requests/${id}/reject`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rejectionReason: formData.get('rejectionReason') })
  });
  revalidatePath(`/admin/organization-requests/${id}`);

  if (!result.ok) {
    redirect(`/admin/organization-requests/${id}?error=${encodeURIComponent(result.error.message)}` as Route);
  }

  redirect(`/admin/organization-requests/${id}?rejected=1` as Route);
}

export default async function AdminOrganizationRequestPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ approved?: string; rejected?: string; error?: string; createdOrganizationId?: string }>;
}) {
  const { id } = await params;
  const { approved, rejected, error, createdOrganizationId } = await searchParams;
  await requirePlatformAdmin(`/admin/organization-requests/${id}`);

  const result = await apiFetch<OrganizationRequestDetail>(`/admin/organization-requests/${id}`);

  if (!result.ok) {
    return <main className="section shell">Request not found.</main>;
  }

  const request = result.data;

  return (
    <main className="section">
      <div className="shell stack">
        <h1>{request.organizationName}</h1>
        {error ? <p className="text-red-600">{error}</p> : null}
        {approved && (createdOrganizationId || request.createdOrganization?.id) ? (
          <p>
            Request approved.
            {' '}
            <Link href={`/admin/organizations/${createdOrganizationId ?? request.createdOrganization?.id}` as Route}>
              View organization
            </Link>
          </p>
        ) : null}
        {rejected ? <p>Request rejected.</p> : null}
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
