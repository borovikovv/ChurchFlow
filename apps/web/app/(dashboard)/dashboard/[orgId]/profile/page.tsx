import { redirect } from 'next/navigation';
import { getCurrentUser, requireServerSession } from '@/auth/session';
import { ProfileForm } from '@/features/profile/components/profile-form';
import { PageHeader } from '@/components/ui/page-header';

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
        <ProfileForm
          displayName={user.displayName}
          email={user.email}
          platformRole={user.platformRole}
          baptizedAt={user.baptizedAt?.slice(0, 10) ?? null}
          baptismChurchName={user.baptismChurchName}
        />
      </div>
    </main>
  );
}
