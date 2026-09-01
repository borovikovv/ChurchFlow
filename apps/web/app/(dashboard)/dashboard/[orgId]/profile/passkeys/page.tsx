import { redirect } from 'next/navigation';
import { getCurrentUser, requireServerSession } from '@/auth/session';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { getMessages } from '@/i18n/messages';
import { profileTabItems } from '@/features/profile/profile-tabs';
import { PasskeyList } from '@/features/passkeys/components/passkey-list';
import { getPasskeys } from '@/features/passkeys/server/actions';

export default async function OrganizationProfilePasskeysPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireServerSession(`/dashboard/${orgId}/profile/passkeys`);

  const [user, passkeysResult] = await Promise.all([getCurrentUser(), getPasskeys()]);
  if (!user) {
    redirect('/login');
  }
  const messages = getMessages(user.locale);

  return (
    <main className="stack">
      <PageHeader title={messages.profile.title} description={messages.passkeys.description} />
      <Tabs label={messages.profile.settings} items={profileTabItems(orgId, messages)} />
      {passkeysResult.ok ? (
        <PasskeyList passkeys={passkeysResult.data} locale={user.locale} />
      ) : (
        <p className="form-error">{passkeysResult.error.message}</p>
      )}
    </main>
  );
}
