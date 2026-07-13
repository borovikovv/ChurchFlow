import { redirect } from 'next/navigation';
import { getCurrentUser, requireServerSession } from '@/auth/session';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import {
  organizationProfileNotificationsRoute,
  organizationProfileRoute,
} from '@/features/organizations/routes';
import { NotificationPreferencesForm } from '@/features/notifications/components/notification-preferences-form';
import { getNotificationPreferences } from '@/features/notifications/server/actions';

export default async function OrganizationNotificationPreferencesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireServerSession(`/dashboard/${orgId}/profile/notifications`);

  const [user, preferencesResult] = await Promise.all([
    getCurrentUser(),
    getNotificationPreferences(orgId),
  ]);
  if (!user) {
    redirect('/login');
  }

  return (
    <main className="stack">
      <PageHeader
        title="Profile"
        description="Your identity and notification preferences in ChurchFlow."
      />
      <Tabs
        label="Profile settings"
        items={[
          { label: 'Profile', href: organizationProfileRoute(orgId) },
          {
            label: 'Notifications',
            href: organizationProfileNotificationsRoute(orgId),
          },
        ]}
      />
      {preferencesResult.ok ? (
        <NotificationPreferencesForm
          organizationId={orgId}
          preferences={preferencesResult.data}
          userEmail={user.email}
        />
      ) : (
        <section className="stack max-w-2xl rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
          <h2 className="m-0 text-2xl">Notification preferences unavailable</h2>
          <p className="m-0 text-[var(--muted)]">{preferencesResult.error.message}</p>
        </section>
      )}
    </main>
  );
}
