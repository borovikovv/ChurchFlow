import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { apiFetch } from '@/api/client';
import { getCurrentUser, requirePlatformAdmin } from '@/auth/session';
import { Button, ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';
import { getMessages } from '@/i18n/messages';

interface OrganizationRequestDetail {
  id: string;
  organizationName: string;
  organizationSlug: string | null;
  contactName: string;
  contactEmail: string | null;
  contactTelegramId: string | null;
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
  const user = await getCurrentUser();
  const allMessages = getMessages(user?.locale ?? 'en');
  const messages = allMessages.adminPages;
  const commonMessages = allMessages.common;

  const result = await apiFetch<OrganizationRequestDetail>(`/admin/organization-requests/${id}`);

  if (!result.ok) {
    return <main className="page-content form-error">{result.error.message}</main>;
  }

  const request = result.data;

  return (
    <main className="page-content stack">
      <PageHeader
        title={request.organizationName}
        description={messages.organizationRequestDetail.description}
        actions={
          <ButtonLink href="/admin/organizations?view=requests" variant="secondary">
            {messages.organizationRequestDetail.back}
          </ButtonLink>
        }
      />
      <div className="stack">
        {error ? <p className="text-red-600">{error}</p> : null}
        {approved && (createdOrganizationId || request.createdOrganization?.id) ? (
          <p>
            {messages.organizationRequestDetail.approved}{' '}
            <Link
              href={
                `/admin/organizations/${createdOrganizationId ?? request.createdOrganization?.id}` as Route
              }
            >
              {messages.organizationRequestDetail.viewOrganization}
            </Link>
          </p>
        ) : null}
        {rejected ? <p>{messages.organizationRequestDetail.rejected}</p> : null}
        <dl className="details">
          <dt>{messages.organizationRequestDetail.status}</dt>
          <dd>
            <StatusBadge
              label={
                messages.statuses[request.status as keyof typeof messages.statuses] ??
                request.status
              }
              status={request.status}
            />
          </dd>
          <dt>{messages.organizationRequestDetail.contact}</dt>
          <dd>
            {request.contactName} ·{' '}
            {request.contactEmail ?? messages.organizationRequestDetail.noEmail}
          </dd>
          <dt>{messages.organizationRequestDetail.telegram}</dt>
          <dd>
            {request.contactTelegramUsername ??
              request.contactTelegramId ??
              messages.organizationRequestDetail.notProvided}
          </dd>
          <dt>{messages.organizationRequestDetail.phone}</dt>
          <dd>{request.contactPhone ?? messages.organizationRequestDetail.notProvided}</dd>
          <dt>{messages.organizationRequestDetail.message}</dt>
          <dd>{request.message ?? messages.organizationRequestDetail.noMessage}</dd>
        </dl>
        {request.status === 'PENDING' ? (
          <div className="review-actions-grid">
            <form className="form-grid" action={approveRequest}>
              <input type="hidden" name="id" value={request.id} />
              <label>
                {messages.organizationRequestDetail.organizationName}
                <input name="organizationName" defaultValue={request.organizationName} />
              </label>
              <label>
                {messages.organizationRequestDetail.slug}
                <input name="organizationSlug" defaultValue={request.organizationSlug ?? ''} />
              </label>
              <Button type="submit">{messages.organizationRequestDetail.approve}</Button>
            </form>
            <form className="form-grid" action={rejectRequest}>
              <input type="hidden" name="id" value={request.id} />
              <label>
                {messages.organizationRequestDetail.rejectionReason}
                <textarea
                  name="rejectionReason"
                  required
                  rows={4}
                  defaultValue={request.rejectionReason ?? ''}
                />
              </label>
              <ConfirmSubmitButton
                cancelLabel={commonMessages.cancel}
                confirmLabel={messages.organizationRequestDetail.rejectConfirm}
                confirmVariant="danger"
                description={formatAdminMessage(
                  messages.organizationRequestDetail.rejectDescription,
                  { name: request.organizationName },
                )}
                pendingLabel={commonMessages.saving}
                title={messages.organizationRequestDetail.rejectTitle}
                triggerLabel={messages.organizationRequestDetail.reject}
              />
            </form>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function formatAdminMessage(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, value),
    template,
  );
}
