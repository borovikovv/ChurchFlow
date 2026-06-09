import Link from 'next/link';

export default async function DashboardLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}>) {
  const { orgId } = await params;

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
