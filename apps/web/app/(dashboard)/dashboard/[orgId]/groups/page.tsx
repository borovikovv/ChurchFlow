import { getCurrentUser } from '@/auth/session';
import { Tabs } from '@/components/ui/tabs';
import { organizationGroupsRoute } from '@/features/organizations/routes';
import { getMessages } from '@/i18n/messages';
import {
  organizationGroupsViewSchema,
  type OrganizationGroupsPayload,
  type OrganizationGroupsView,
} from '@churchflow/shared';
import { loadGroupBoardAction, loadGroupsAction } from './actions';
import { GroupsBoardView } from './_components/board/groups-board-view';
import { GroupsManager } from './_components/groups-manager';

const emptyGroupsPayload: OrganizationGroupsPayload = {
  canManage: false,
  groups: [],
};

export default async function GroupsDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { orgId } = await params;
  const { view: requestedView } = await searchParams;
  const view = parseGroupsView(requestedView);
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? 'en');
  const [groupsResult, boardResult] = await Promise.all([
    loadGroupsAction({ organizationId: orgId }),
    view === 'board' ? loadGroupBoardAction({ organizationId: orgId }) : null,
  ]);
  const payload = groupsResult.ok ? groupsResult.payload : emptyGroupsPayload;
  const groupsHref = organizationGroupsRoute(orgId);

  return (
    <div className="stack">
      <div className="min-w-0">
        <h1>{messages.groups.title}</h1>
        <p>{messages.groups.subtitle}</p>
      </div>
      {!groupsResult.ok ? <p className="form-error">{groupsResult.error}</p> : null}

      <div className="hidden md:block">
        <Tabs
          label={messages.groups.board.viewLabel}
          items={[
            { label: messages.groups.board.listView, href: groupsHref, active: view === 'list' },
            {
              label: messages.groups.board.boardView,
              href: `${groupsHref}?view=board`,
              active: view === 'board',
            },
          ]}
        />
      </div>

      {boardResult ? (
        <>
          {/* The board is desktop-only; narrow screens keep the list. */}
          <section className="stack min-w-0 md:hidden">
            <GroupsManager initialPayload={payload} organizationId={orgId} />
          </section>
          <section className="hidden min-w-0 md:block">
            {boardResult.ok ? (
              <GroupsBoardView initialPayload={boardResult.payload} organizationId={orgId} />
            ) : (
              <p className="form-error">{boardResult.error}</p>
            )}
          </section>
        </>
      ) : (
        <section className="stack min-w-0">
          <GroupsManager initialPayload={payload} organizationId={orgId} />
        </section>
      )}
    </div>
  );
}

function parseGroupsView(view: string | string[] | undefined): OrganizationGroupsView {
  const parsedView = organizationGroupsViewSchema.safeParse(view);
  return parsedView.success ? parsedView.data : 'list';
}
