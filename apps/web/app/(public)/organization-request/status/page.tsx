import { apiFetch } from '@/api/client';
import { requireServerSession } from '@/auth/session';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';

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
      />
      <div className="stack">
        {!result.ok ? <p className="form-error">{result.error.message}</p> : null}
        {requests.length === 0 ? (
          <p>No organization requests yet.</p>
        ) : (
          <div className="data-list w-full">
            {requests.map((request) => (
              <section className="row" key={request.id}>
                <strong>{request.organizationName}</strong>
                <StatusBadge status={request.status} />
                <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                {request.status === 'PENDING' ? <span>Waiting for platform review</span> : null}
                {request.status === 'REJECTED' ? (
                  <span>{request.rejectionReason ?? 'The request was rejected.'}</span>
                ) : null}
                {request.status === 'APPROVED' && request.createdOrganization ? (
                  <ButtonLink href={`/dashboard/${request.createdOrganization.id}`}>
                    Open dashboard
                  </ButtonLink>
                ) : null}
              </section>
            ))}
          </div>
        )}
        {!requests.some((request) => request.status === 'PENDING') ? (
          <ButtonLink href="/organization-request" variant="secondary">
            Submit another request
          </ButtonLink>
        ) : null}
      </div>
    </main>
  );
}
