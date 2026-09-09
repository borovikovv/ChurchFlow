import { getCurrentUser } from '@/auth/session';
import { getMessages } from '@/i18n/messages';
import type { OrganizationGroupsPayload } from '@churchflow/shared';
import { loadGroupsAction } from './actions';
import { GroupsManager } from './_components/groups-manager';

const emptyGroupsPayload: OrganizationGroupsPayload = {
  canManage: false,
  groups: [],
};

export default async function GroupsDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? 'en');
  const groupsResult = await loadGroupsAction({ organizationId: orgId });
  const payload = groupsResult.ok ? groupsResult.payload : emptyGroupsPayload;

  return (
    <div className="stack">
      <div className="min-w-0">
        <h1>{messages.groups.title}</h1>
        <p>{messages.groups.subtitle}</p>
      </div>
      {!groupsResult.ok ? <p className="form-error">{groupsResult.error}</p> : null}

      <section className="stack min-w-0">
        <GroupsManager initialPayload={payload} organizationId={orgId} />
      </section>
    </div>
  );
}
