import { redirect } from 'next/navigation';
import { getCurrentUser, requireServerSession } from '@/auth/session';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProfileCard } from './_components/profile-card';
import { ProfileForm } from './_components/profile-form';

export default async function ProfilePage() {
  await requireServerSession('/profile');

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <main className="page-content stack">
      <PageHeader title="Profile" description="Your identity and platform access in ChurchFlow." />
      <div className="stack max-w-xl">
        <ProfileCard
          title="Account information"
          description="Your identity and platform access in ChurchFlow."
        >
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
        </ProfileCard>
        <ProfileForm
          baptizedAt={user.baptizedAt?.slice(0, 10) ?? null}
          baptismChurchName={user.baptismChurchName}
        />
      </div>
    </main>
  );
}
