import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { apiFetch } from '@/api/client';

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
      <nav className="stack" aria-label="Organization dashboard">
        <strong>ChurchFlow</strong>
        <Link href={`/dashboard/${orgId}`}>Overview</Link>
        <Link href={`/dashboard/${orgId}/website`}>Website</Link>
        <Link href={`/dashboard/${orgId}/members`}>Members</Link>
      </nav>
      <main>{children}</main>
    </div>
  );
}
