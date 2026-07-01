import Link from 'next/link';
import { apiFetch } from '@/api/client';
import { requireServerSession } from '@/auth/session';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { OrganizationRequestActions } from './_components/organization-request-actions';

interface OrganizationRequestStatus {
  id: string;
  organizationName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  rejectionReason: string | null;
  createdAt: string;
  createdOrganization: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export default async function OrganizationRequestStatusPage() {
  await requireServerSession('/organization-request/status');
  const result = await apiFetch<OrganizationRequestStatus[]>('/organization-requests/mine');
  const requests = result.ok ? result.data : [];

  return (
    <main className="page-content stack">
      <PageHeader
        title="My organization requests"
        description="Track review progress and open organizations once they are approved."
        actions={
          !requests.some((request) => request.status === 'PENDING') ? (
            <ButtonLink href="/organization-request">Submit another request</ButtonLink>
          ) : null
        }
      />
      <div className="stack">
        {!result.ok ? <p className="form-error">{result.error.message}</p> : null}
        {requests.length === 0 ? (
          <p>No organization requests yet.</p>
        ) : (
          <div className="data-list w-full overflow-visible">
            {requests.map((request) => (
              <section className="row" key={request.id}>
                {request.status === 'APPROVED' && request.createdOrganization ? (
                  <Link
                    className="cursor-pointer font-bold text-[var(--foreground)] hover:text-[var(--accent)] hover:underline"
                    href={`/dashboard/${request.createdOrganization.id}`}
                  >
                    {request.organizationName}
                  </Link>
                ) : (
                  <strong>{request.organizationName}</strong>
                )}
                <StatusBadge status={request.status} />
                <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                {request.status === 'PENDING' ? <span>Waiting for platform review</span> : null}
                {request.status === 'REJECTED' ? (
                  <span>{request.rejectionReason ?? 'The request was rejected.'}</span>
                ) : null}
                {request.status === 'APPROVED' && request.createdOrganization ? (
                  <OrganizationRequestActions
                    dashboardHref={`/dashboard/${request.createdOrganization.id}`}
                  />
                ) : null}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
