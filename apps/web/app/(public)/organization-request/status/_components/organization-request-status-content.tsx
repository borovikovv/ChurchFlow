'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { OrganizationRequestStatusItem } from '@churchflow/shared';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { OrganizationRequestActions } from './organization-request-actions';
import type { OrganizationRequestStatusContentProps } from './organization-request-status-content.types';

export function OrganizationRequestStatusContent({
  initialRequests,
  loadError,
}: OrganizationRequestStatusContentProps) {
  const [requests, setRequests] = useState(initialRequests);
  const hasPendingRequest = requests.some((request) => request.status === 'PENDING');

  const addResubmittedRequest = (request: OrganizationRequestStatusItem) => {
    setRequests((current) => [request, ...current]);
  };

  const removeRequest = (requestId: string) => {
    setRequests((current) => current.filter((request) => request.id !== requestId));
  };

  return (
    <main className="page-content stack">
      <PageHeader
        title="My organization requests"
        description="Track review progress and open organizations once they are approved."
        actions={
          !hasPendingRequest ? (
            <ButtonLink href="/organization-request">Submit another request</ButtonLink>
          ) : null
        }
      />
      <div className="stack">
        {loadError ? <p className="form-error">{loadError}</p> : null}
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
                {request.status === 'APPROVED' || request.status === 'EXPIRED' ? (
                  <OrganizationRequestActions
                    request={request}
                    hasPendingRequest={hasPendingRequest}
                    onResubmitted={addResubmittedRequest}
                    onDeleted={removeRequest}
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
