import { redirect } from 'next/navigation';
import { getCurrentUser, requireServerSession } from '@/auth/session';
import { ProfileForm } from '@/features/profile/components/profile-form';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { getMessages } from '@/i18n/messages';
import {
  organizationProfileNotificationsRoute,
  organizationProfileRoute,
  organizationProfileSessionsRoute,
} from '@/features/organizations/routes';

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
  const messages = getMessages(user.locale);

  return (
    <main className="stack">
      <PageHeader title={messages.profile.title} description={messages.profile.description} />
      <Tabs
        label={messages.profile.settings}
        items={[
          { label: messages.profile.title, href: organizationProfileRoute(orgId) },
          {
            label: messages.profile.notifications,
            href: organizationProfileNotificationsRoute(orgId),
          },
          { label: messages.sessions.title, href: organizationProfileSessionsRoute(orgId) },
        ]}
      />
      <div className="stack max-w-xl">
        <ProfileForm
          displayName={user.displayName}
          email={user.email}
          platformRole={user.platformRole}
          baptizedAt={user.baptizedAt?.slice(0, 10) ?? null}
          baptismChurchName={user.baptismChurchName}
          locale={user.locale}
        />
      </div>
    </main>
  );
}
