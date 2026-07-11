import { redirect } from 'next/navigation';
import { getCurrentUser, requireServerSession } from '@/auth/session';
import { ProfileCard } from '@/features/profile/components/profile-card';
import { ProfileForm } from '@/features/profile/components/profile-form';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';

export default async function OrganizationProfilePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireServerSession(`/dashboard/${orgId}/profile`);

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <main className="stack">
      <PageHeader title="Profile" description="Your identity and platform access in ChurchFlow." />
      <div className="stack max-w-xl">
        <ProfileCard
          title="Account information"
          description="Your identity and platform access in ChurchFlow."
        >
          <dl className="details">
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
