import { redirect } from 'next/navigation';
import { getCurrentUser, requireServerSession } from '@/auth/session';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { getMessages } from '@/i18n/messages';
import { profileTabItems } from '@/features/profile/profile-tabs';
import { SessionList } from '@/features/sessions/components/session-list';
import { getSessions } from '@/features/sessions/server/actions';

export default async function OrganizationProfileSessionsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireServerSession(`/dashboard/${orgId}/profile/sessions`);

  const [user, sessionsResult] = await Promise.all([getCurrentUser(), getSessions()]);
  if (!user) {
    redirect('/login');
  }
  const messages = getMessages(user.locale);

  return (
    <main className="stack">
      <PageHeader title={messages.profile.title} description={messages.sessions.description} />
      <Tabs label={messages.profile.settings} items={profileTabItems(orgId, messages)} />
      {sessionsResult.ok ? (
        <SessionList sessions={sessionsResult.data} locale={user.locale} />
      ) : (
        <p className="form-error">{sessionsResult.error.message}</p>
      )}
    </main>
  );
}
