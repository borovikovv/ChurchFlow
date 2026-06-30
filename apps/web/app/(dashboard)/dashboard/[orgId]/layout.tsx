import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { apiFetch } from '@/api/client';
import { Tabs } from '@/components/ui/tabs';

export default async function DashboardLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}>) {
  const { orgId } = await params;
  const access = await apiFetch(`/organizations/${orgId}/website`);

  if (!access.ok) {
    redirect('/invitations/pending' as Route);
  }

  return (
    <div className="dashboard">
      <Tabs
        label="Organization dashboard"
        items={[
          { label: 'Overview', href: `/dashboard/${orgId}` },
          { label: 'Website', href: `/dashboard/${orgId}/website` },
          { label: 'Members', href: `/dashboard/${orgId}/members` },
        ]}
      />
      <main>{children}</main>
    </div>
  );
}
