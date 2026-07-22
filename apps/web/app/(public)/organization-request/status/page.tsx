import type { OrganizationRequestStatusItem } from '@churchflow/shared';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/api/client';
import { getCurrentUser, requireServerSession } from '@/auth/session';
import { APP_ROUTES } from '@/routes';
import { OrganizationRequestStatusContent } from './_components/organization-request-status-content';

export default async function OrganizationRequestStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; notification?: string }>;
}) {
  await requireServerSession('/organization-request/status');
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `${APP_ROUTES.login}?redirectTo=${encodeURIComponent(APP_ROUTES.organizationRequestStatus)}`,
    );
  }
  const result = await apiFetch<OrganizationRequestStatusItem[]>('/organization-requests/mine');
  const requests = result.ok ? result.data : [];
  const params = await searchParams;
  const submissionMessage =
    params.submitted === '1'
      ? params.notification === 'sent'
        ? { tone: 'success' as const, text: 'Organization request submitted and admin notified.' }
        : {
            tone: 'warning' as const,
            text: 'Organization request submitted, but admin email notification could not be delivered.',
          }
      : null;

  return (
    <OrganizationRequestStatusContent
      initialRequests={requests}
      loadError={result.ok ? null : result.error.message}
      submissionMessage={submissionMessage}
    />
  );
}
