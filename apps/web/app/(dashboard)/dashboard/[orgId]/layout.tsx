import { redirect } from 'next/navigation';
import type { Route } from 'next';
import type { Metadata } from 'next';
import { ENTITLEMENTS } from '@churchflow/shared';
import { requireServerSession } from '@/auth/session';
import {
  getOrganizationAccessState,
  isOrganizationAdminRole,
  organizationHasEntitlement,
} from '@/features/organizations/server/access';
import { RestrictedBanner } from './_components/restricted-banner';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}>) {
  const { orgId } = await params;
  await requireServerSession(`/dashboard/${orgId}`);

  const access = await getOrganizationAccessState();
  const organization = access.organizations.find((record) => record.id === orgId);

  if (!organization && !access.isPlatformAdmin) {
    redirect('/invitations/pending' as Route);
  }

  // members.write stands in for "may write anything": resolution grants either the full set or
  // the read-only one, so any write entitlement answers the same question.
  const isRestricted =
    organization !== undefined &&
    !organizationHasEntitlement(organization, ENTITLEMENTS.membersWrite);

  return (
    <div className="dashboard">
      <main>
        {isRestricted && organization ? (
          <RestrictedBanner
            canManageBilling={isOrganizationAdminRole(organization.role)}
            organizationId={orgId}
            status={organization.subscriptionStatus}
          />
        ) : null}
        {children}
      </main>
    </div>
  );
}
