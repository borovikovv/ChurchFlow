import { redirect } from 'next/navigation';
import type { Route } from 'next';
import type { Metadata } from 'next';
import { requireServerSession } from '@/auth/session';
import { getOrganizationAccessState } from '@/features/organizations/server/access';

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
  // A lapsed session and a missing membership both surface as an empty organization list,
  // so the session is settled first: otherwise the visitor is sent to /invitations/pending
  // and loses the page they actually asked for.
  await requireServerSession(`/dashboard/${orgId}`);

  const access = await getOrganizationAccessState();
  const hasMembership = access.organizations.some((organization) => organization.id === orgId);

  if (!hasMembership && !access.isPlatformAdmin) {
    redirect('/invitations/pending' as Route);
  }

  return (
    <div className="dashboard">
      <main>{children}</main>
    </div>
  );
}
