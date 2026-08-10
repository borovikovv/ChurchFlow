import { apiFetch } from '@/api/client';
import { getCurrentUser, requireServerSession } from '@/auth/session';
import { ButtonLink } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { DEFAULT_APP_LOCALE } from '@/i18n/locales';
import { getMessages } from '@/i18n/messages';

interface ClaimStatus {
  id: string;
  status: 'PENDING' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  membership: {
    organizationId: string;
    organization: { name: string };
  };
}

export default async function MembershipClaimStatusPage() {
  await requireServerSession('/member-claims/status');
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? DEFAULT_APP_LOCALE).auth;
  const result = await apiFetch<ClaimStatus[]>('/membership-claims/status');
  const claims = result.ok ? result.data : [];

  return (
    <main className="section auth-section">
      <div className="shell stack auth-flow-panel">
        <h1>{messages.appAccessRequests}</h1>
        {!result.ok ? <p className="form-error">{result.error.message}</p> : null}
        {claims.length === 0 ? <p>{messages.noMembershipAccessRequests}</p> : null}
        {claims.map((claim) => (
          <article className="form-grid" key={claim.id}>
            <strong>{claim.membership.organization.name}</strong>
            <StatusBadge status={claim.status} />
            {claim.status === 'REQUESTED' ? (
              <p>{messages.waitingForOrganizationAdministrator}</p>
            ) : null}
            {claim.status === 'APPROVED' ? (
              <ButtonLink href={`/dashboard/${claim.membership.organizationId}`}>
                {messages.openDashboard}
              </ButtonLink>
            ) : null}
            {claim.status === 'REJECTED' ? <p>{messages.requestRejected}</p> : null}
          </article>
        ))}
      </div>
    </main>
  );
}
