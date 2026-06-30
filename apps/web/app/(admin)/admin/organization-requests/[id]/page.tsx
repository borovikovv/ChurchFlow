import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { apiFetch } from '@/api/client';
import { requirePlatformAdmin } from '@/auth/session';
import { Button, ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';

interface OrganizationRequestDetail {
  id: string;
  organizationName: string;
  organizationSlug: string | null;
  contactName: string;
  contactEmail: string | null;
  contactTelegramId: string;
  contactTelegramUsername: string | null;
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
  const result = await apiFetch<ApproveOrganizationRequestResult>(
    `/admin/organization-requests/${id}/approve`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationName: formData.get('organizationName') || undefined,
        organizationSlug: formData.get('organizationSlug') || undefined,
      }),
    },
  );
  revalidatePath(`/admin/organization-requests/${id}`);

  if (!result.ok) {
    redirect(
      `/admin/organization-requests/${id}?error=${encodeURIComponent(result.error.message)}` as Route,
    );
  }

  redirect(
    `/admin/organization-requests/${id}?approved=1&createdOrganizationId=${encodeURIComponent(result.data.organization.id)}` as Route,
  );
}

async function rejectRequest(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const result = await apiFetch(`/admin/organization-requests/${id}/reject`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rejectionReason: formData.get('rejectionReason') }),
  });
  revalidatePath(`/admin/organization-requests/${id}`);

  if (!result.ok) {
    redirect(
      `/admin/organization-requests/${id}?error=${encodeURIComponent(result.error.message)}` as Route,
    );
  }

  redirect(`/admin/organization-requests/${id}?rejected=1` as Route);
}

export default async function AdminOrganizationRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    approved?: string;
    rejected?: string;
    error?: string;
    createdOrganizationId?: string;
  }>;
}) {
  const { id } = await params;
  const { approved, rejected, error, createdOrganizationId } = await searchParams;
  await requirePlatformAdmin(`/admin/organization-requests/${id}`);

  const result = await apiFetch<OrganizationRequestDetail>(`/admin/organization-requests/${id}`);

  if (!result.ok) {
    return <main className="page-content form-error">{result.error.message}</main>;
  }

  const request = result.data;

  return (
    <main className="page-content stack">
      <PageHeader
        title={request.organizationName}
        description="Review requester identity and decide whether to create this tenant."
        actions={
          <ButtonLink href="/admin/organizations?view=requests" variant="secondary">
            Back to requests
          </ButtonLink>
        }
      />
      <div className="stack">
        {error ? <p className="text-red-600">{error}</p> : null}
        {approved && (createdOrganizationId || request.createdOrganization?.id) ? (
          <p>
            Request approved.{' '}
            <Link
              href={
                `/admin/organizations/${createdOrganizationId ?? request.createdOrganization?.id}` as Route
              }
            >
              View organization
            </Link>
          </p>
        ) : null}
        {rejected ? <p>Request rejected.</p> : null}
        <dl className="details">
          <dt>Status</dt>
          <dd>
            <StatusBadge status={request.status} />
          </dd>
          <dt>Contact</dt>
          <dd>
            {request.contactName} · {request.contactEmail ?? 'No email'}
          </dd>
          <dt>Telegram</dt>
          <dd>{request.contactTelegramUsername ?? request.contactTelegramId}</dd>
          <dt>Phone</dt>
          <dd>{request.contactPhone ?? 'Not provided'}</dd>
          <dt>Message</dt>
          <dd>{request.message ?? 'No message'}</dd>
        </dl>
        {request.status === 'PENDING' ? (
          <div className="review-actions-grid">
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
              <Button type="submit">Approve</Button>
            </form>
            <form className="form-grid" action={rejectRequest}>
              <input type="hidden" name="id" value={request.id} />
              <label>
                Rejection reason
                <textarea
                  name="rejectionReason"
                  required
                  rows={4}
                  defaultValue={request.rejectionReason ?? ''}
                />
              </label>
              <ConfirmSubmitButton
                confirmLabel="Reject request"
                confirmVariant="danger"
                description={`Reject the request for ${request.organizationName}. The requester will see the reason you entered.`}
                title="Reject organization request?"
                triggerLabel="Reject"
              />
            </form>
          </div>
        ) : null}
      </div>
    </main>
  );
}
