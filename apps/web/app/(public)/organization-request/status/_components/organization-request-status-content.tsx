'use client';

import { useState } from 'react';
import type { OrganizationRequestStatusItem } from '@churchflow/shared';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { APP_ROUTES } from '@/routes';
import type { OrganizationRequestStatusContentProps } from './organization-request-status-content.types';
import { OrganizationRequestStatusTable } from './organization-request-status-table';

export function OrganizationRequestStatusContent({
  initialRequests,
  loadError,
  submissionMessage,
}: OrganizationRequestStatusContentProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [feedback, setFeedback] = useState(submissionMessage);
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
            <ButtonLink href={APP_ROUTES.organizationRequest}>Submit another request</ButtonLink>
          ) : null
        }
      />
      <div className="stack">
        {loadError ? <p className="form-error">{loadError}</p> : null}
        {feedback ? (
          <p
            className={
              feedback.tone === 'success'
                ? 'm-0 rounded-md border border-[rgba(26,127,55,0.2)] bg-[rgba(26,127,55,0.08)] px-3 py-2 text-[var(--success)]'
                : 'm-0 rounded-md border border-[rgba(154,103,0,0.2)] bg-[rgba(154,103,0,0.08)] px-3 py-2 text-[var(--warning)]'
            }
          >
            {feedback.text}
          </p>
        ) : null}
        {requests.length === 0 ? (
          <p>No organization requests yet.</p>
        ) : (
          <OrganizationRequestStatusTable
            hasPendingRequest={hasPendingRequest}
            onDeleted={removeRequest}
            onNotificationResult={setFeedback}
            onResubmitted={addResubmittedRequest}
            requests={requests}
          />
        )}
      </div>
    </main>
  );
}
