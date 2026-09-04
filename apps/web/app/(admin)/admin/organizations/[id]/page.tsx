import { apiFetch } from '@/api/client';
import { getCurrentUser, requirePlatformAdmin } from '@/auth/session';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { getMessages } from '@/i18n/messages';
import { OrganizationExemptionForm } from '@/components/admin/organization-exemption-form';
import { OrganizationLifecycleActions } from '@/components/admin/organization-lifecycle-actions';

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  description: string | null;
  archivedAt: string | null;
  suspendedAt: string | null;
  deletedAt: string | null;
  subscription: {
    status: string;
    isExempt: boolean;
    exemptReason: string | null;
    exemptGrantedAt: string | null;
    exemptGrantedBy: { id: string; displayName: string | null; email: string | null } | null;
  } | null;
}

export default async function AdminOrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePlatformAdmin(`/admin/organizations/${id}`);
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? 'en').adminPages;

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
          <dt>{messages.organizationDetail.billing}</dt>
          <dd>
            {organization.subscription ? (
              <div className="stack">
                <div className="actions">
                  <StatusBadge
                    label={
                      messages.organizationDetail.subscriptionStatuses[
                        organization.subscription
                          .status as keyof typeof messages.organizationDetail.subscriptionStatuses
                      ] ?? organization.subscription.status
                    }
                    status={organization.subscription.status}
                  />
                  {organization.subscription.isExempt ? (
                    <StatusBadge
                      label={messages.organizationDetail.complimentary}
                      status="ACTIVE"
                    />
                  ) : null}
                </div>
                {organization.subscription.isExempt ? (
                  <p className="m-0 text-[var(--muted)]">
                    {formatAdminMessage(messages.organizationDetail.complimentaryDetail, {
                      reason:
                        organization.subscription.exemptReason ??
                        messages.organizationDetail.noDescription,
                      grantedBy:
                        organization.subscription.exemptGrantedBy?.displayName ??
                        organization.subscription.exemptGrantedBy?.email ??
                        messages.organizationDetail.unknownAdmin,
                    })}
                  </p>
                ) : null}
              </div>
            ) : (
              messages.organizationDetail.noSubscription
            )}
          </dd>
        </dl>
        <OrganizationExemptionForm
          isExempt={organization.subscription?.isExempt ?? false}
          organizationId={organization.id}
          organizationName={organization.name}
        />
        <OrganizationLifecycleActions
          organizationId={organization.id}
          organizationName={organization.name}
          status={organization.status}
        />
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
