import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { getCurrentUser, requireServerSession } from '@/auth/session';

export default async function ProfilePage() {
  await requireServerSession('/profile');

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?error=Unable%20to%20load%20profile' as Route);
  }

  return (
    <main className="section">
      <div className="shell stack">
        <h1>Profile</h1>
        <dl className="details">
          <dt>User ID</dt>
          <dd>{user.id}</dd>
          <dt>Email</dt>
          <dd>{user.email ?? 'Not set'}</dd>
          <dt>Name</dt>
          <dd>{user.displayName ?? 'Not set'}</dd>
          <dt>Platform role</dt>
          <dd>{user.platformRole}</dd>
        </dl>
      </div>
    </main>
  );
}
