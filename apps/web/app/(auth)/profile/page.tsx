import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { getCurrentUser, requireServerSession } from '@/auth/session';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';

export default async function ProfilePage() {
  await requireServerSession('/profile');

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?error=Unable%20to%20load%20profile' as Route);
  }

  return (
    <main className="page-content stack">
      <PageHeader title="Profile" description="Your identity and platform access in ChurchFlow." />
      <div className="stack">
        <dl className="details">
          <dt>User ID</dt>
          <dd>{user.id}</dd>
          <dt>Email</dt>
          <dd>{user.email ?? 'Not set'}</dd>
          <dt>Name</dt>
          <dd>{user.displayName ?? 'Not set'}</dd>
          <dt>Platform role</dt>
          <dd>
            <StatusBadge status={user.platformRole} />
          </dd>
        </dl>
      </div>
    </main>
  );
}
