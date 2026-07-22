import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { apiFetch } from '@/api/client';
import { getCurrentUser, requirePlatformAdmin } from '@/auth/session';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';
import { getMessages } from '@/i18n/messages';

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
  const messages = await currentAdminMessages();
  const id = String(formData.get('id'));
  const action = String(formData.get('action'));
  const result = await apiFetch(`/admin/organizations/${id}/${action}`, { method: 'POST' });
  revalidatePath(`/admin/organizations/${id}`);
  const params = result.ok
    ? new URLSearchParams({ message: messages.organizationDetail.statusUpdated })
    : new URLSearchParams({ error: result.error.message });
  redirect(`/admin/organizations/${id}?${params.toString()}` as Route);
}

async function currentAdminMessages() {
  const user = await getCurrentUser();
  return getMessages(user?.locale ?? 'en').adminPages;
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
  const user = await getCurrentUser();
  const allMessages = getMessages(user?.locale ?? 'en');
  const messages = allMessages.adminPages;
  const commonMessages = allMessages.common;

  const result = await apiFetch<OrganizationDetail>(`/admin/organizations/${id}`);

  if (!result.ok) {
    return <main className="page-content form-error">{result.error.message}</main>;
  }

  const organization = result.data;

  return (
    <main className="page-content stack">
      <PageHeader
        title={organization.name}
        description={formatAdminMessage(messages.organizationDetail.description, {
          slug: organization.slug,
        })}
        actions={
          <ButtonLink href="/admin/organizations" variant="secondary">
            {messages.organizationDetail.back}
          </ButtonLink>
        }
      />
      <div className="stack">
        {message ? <p>{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        <dl className="details">
          <dt>{messages.organizationDetail.slug}</dt>
          <dd>{organization.slug}</dd>
          <dt>{messages.organizationDetail.status}</dt>
          <dd>
            <StatusBadge
              label={
                messages.statuses[organization.status as keyof typeof messages.statuses] ??
                organization.status
              }
              status={organization.status}
            />
          </dd>
          <dt>{messages.organizationDetail.descriptionLabel}</dt>
          <dd>{organization.description ?? messages.organizationDetail.noDescription}</dd>
        </dl>
        <form className="actions" action={organizationAction}>
          <input type="hidden" name="id" value={organization.id} />
          {organization.status !== 'ACTIVE' ? (
            <ConfirmSubmitButton
              cancelLabel={commonMessages.cancel}
              confirmLabel={messages.organizationDetail.restoreConfirm}
              description={formatAdminMessage(messages.organizationDetail.restoreDescription, {
                name: organization.name,
              })}
              name="action"
              pendingLabel={commonMessages.saving}
              title={messages.organizationDetail.restoreTitle}
              triggerLabel={messages.organizationDetail.restore}
              value="restore"
              variant="primary"
            />
          ) : null}
          {organization.status !== 'SUSPENDED' && organization.status !== 'DELETED' ? (
            <ConfirmSubmitButton
              cancelLabel={commonMessages.cancel}
              confirmLabel={messages.organizationDetail.suspendConfirm}
              description={formatAdminMessage(messages.organizationDetail.suspendDescription, {
                name: organization.name,
              })}
              name="action"
              pendingLabel={commonMessages.saving}
              title={messages.organizationDetail.suspendTitle}
              triggerLabel={messages.organizationDetail.suspend}
              value="suspend"
            />
          ) : null}
          {organization.status !== 'ARCHIVED' && organization.status !== 'DELETED' ? (
            <ConfirmSubmitButton
              cancelLabel={commonMessages.cancel}
              confirmLabel={messages.organizationDetail.archiveConfirm}
              description={formatAdminMessage(messages.organizationDetail.archiveDescription, {
                name: organization.name,
              })}
              name="action"
              pendingLabel={commonMessages.saving}
              title={messages.organizationDetail.archiveTitle}
              triggerLabel={messages.organizationDetail.archive}
              value="archive"
            />
          ) : null}
          {organization.status !== 'DELETED' ? (
            <ConfirmSubmitButton
              cancelLabel={commonMessages.cancel}
              confirmLabel={messages.organizationDetail.softDeleteConfirm}
              confirmVariant="danger"
              description={formatAdminMessage(messages.organizationDetail.softDeleteDescription, {
                name: organization.name,
              })}
              name="action"
              pendingLabel={commonMessages.saving}
              title={messages.organizationDetail.softDeleteTitle}
              triggerLabel={messages.organizationDetail.softDelete}
              value="delete-soft"
              variant="danger"
            />
          ) : null}
        </form>
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
