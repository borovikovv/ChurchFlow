import { apiFetch } from '@/api/client';
import { requireServerSession } from '@/auth/session';
import { ButtonLink } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';

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
  const result = await apiFetch<ClaimStatus[]>('/membership-claims/status');
  const claims = result.ok ? result.data : [];

  return (
    <main className="section">
      <div className="shell stack">
        <h1>App access requests</h1>
        {!result.ok ? <p className="form-error">{result.error.message}</p> : null}
        {claims.length === 0 ? <p>You have no membership access requests.</p> : null}
        {claims.map((claim) => (
          <article className="form-grid" key={claim.id}>
            <strong>{claim.membership.organization.name}</strong>
            <StatusBadge status={claim.status} />
            {claim.status === 'REQUESTED' ? (
              <p>Waiting for an organization administrator.</p>
            ) : null}
            {claim.status === 'APPROVED' ? (
              <ButtonLink href={`/dashboard/${claim.membership.organizationId}`}>
                Open dashboard
              </ButtonLink>
            ) : null}
            {claim.status === 'REJECTED' ? <p>Your request was rejected.</p> : null}
          </article>
        ))}
      </div>
    </main>
  );
}
