import { getCurrentUser } from '@/auth/session';
import { getMessages } from '@/i18n/messages';
import { MembersActions } from './_components/members-actions';
import { MembersManager } from './_components/members-manager';
import {
  claimAction,
  confirmMemberPhotoAction,
  createRelationshipAction,
  deleteRelationshipAction,
  archiveMemberAction,
  loadMembersAction,
  manageInlineInvitationAction,
  prepareMemberPhotoAction,
  removeMemberAction,
  restoreMemberAction,
  updateMemberRoleAction,
  updateMemberProfileAction,
} from './actions';
import type { MembersPayload } from './types';
import {
  DEFAULT_MEMBER_PAGE_SIZE,
  MEMBER_PAGE_SIZE_OPTIONS,
  organizationMembersAccessFilterSchema,
  organizationMembersTabSchema,
  type OrganizationMembersAccessFilter,
  type OrganizationMembersTab,
  organizationMembersTypeFilterSchema,
  type OrganizationMembersTypeFilter,
  memberMinistriesSchema,
  type MemberMinistry,
} from '@churchflow/shared';

type MembersSearchParams = {
  access?: string;
  error?: string;
  message?: string;
  ministries?: string;
  page?: string;
  pageSize?: string;
  search?: string;
  tab?: string;
  type?: string;
};

const emptyMembersPayload: MembersPayload = {
  actorRole: null,
  actorMembershipId: null,
  memberCandidates: [],
  pagination: {
    page: 1,
    pageCount: 1,
    pageSize: DEFAULT_MEMBER_PAGE_SIZE,
    total: 0,
    nextCursor: null,
  },
  counts: {
    active: 0,
    archived: 0,
  },
  members: [],
  pendingInvitations: [],
};

export default async function MembersDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<MembersSearchParams>;
}) {
  const { orgId } = await params;
  const {
    message,
    error,
    access = 'all',
    ministries = '',
    page = '1',
    pageSize = String(DEFAULT_MEMBER_PAGE_SIZE),
    search = '',
    tab = 'active',
    type = 'all',
  } = await searchParams;
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? 'en');
  const memberAccess = parseMemberAccess(access);
  const memberMinistries = parseMemberMinistries(ministries);
  const memberPage = parseMemberPage(page);
  const memberPageSize = parseMemberPageSize(pageSize);
  const memberTab = parseMemberTab(tab);
  const memberType = parseMemberType(type);
  const memberSearch = parseMemberSearch(search);
  const membersResult = await loadMembersAction({
    organizationId: orgId,
    access: memberAccess,
    ministries: memberMinistries,
    page: memberPage,
    pageSize: memberPageSize,
    tab: memberTab,
    type: memberType,
    search: memberSearch,
  });
  const payload = membersResult.ok ? membersResult.payload : emptyMembersPayload;

  const canManage = payload.actorRole === 'OWNER' || payload.actorRole === 'ADMIN';

  return (
    <div className="stack">
      <div className="flex min-w-0 items-start justify-between gap-3 md:contents">
        <div className="min-w-0 flex-1 md:contents">
          <h1>{messages.members.title}</h1>
          <p>
            {messages.members.yourRole.replace(
              '{role}',
              payload.actorRole
                ? messages.members.roleLabels[payload.actorRole]
                : messages.members.platformAdministrator,
            )}
          </p>
        </div>
        {canManage ? (
          <MembersActions
            manageInvitation={manageInlineInvitationAction}
            organizationId={orgId}
            variant="fab"
          />
        ) : null}
      </div>
      {!membersResult.ok ? <p className="form-error">{membersResult.error}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <MembersManager
        memberAccess={memberAccess}
        memberMinistries={memberMinistries}
        memberPage={memberPage}
        memberPageSize={memberPageSize}
        memberSearch={memberSearch}
        memberTab={memberTab}
        memberType={memberType}
        organizationId={orgId}
        initialPayload={payload}
        manageInvitation={manageInlineInvitationAction}
        updateProfile={updateMemberProfileAction}
        updateRole={updateMemberRoleAction}
        archiveMember={archiveMemberAction}
        removeMember={removeMemberAction}
        restoreMember={restoreMemberAction}
        claimAction={claimAction}
        createRelationship={createRelationshipAction}
        deleteRelationship={deleteRelationshipAction}
        preparePhoto={prepareMemberPhotoAction}
        confirmPhoto={confirmMemberPhotoAction}
      />
    </div>
  );
}

function parseMemberAccess(access: string): OrganizationMembersAccessFilter {
  const parsedAccess = organizationMembersAccessFilterSchema.safeParse(access);
  return parsedAccess.success ? parsedAccess.data : 'all';
}

function parseMemberType(type: string): OrganizationMembersTypeFilter {
  const parsedType = organizationMembersTypeFilterSchema.safeParse(type);
  return parsedType.success ? parsedType.data : 'all';
}

function parseMemberTab(tab: string): OrganizationMembersTab {
  const parsedTab = organizationMembersTabSchema.safeParse(tab);
  return parsedTab.success ? parsedTab.data : 'active';
}

function parseMemberSearch(search: string): string {
  return search.trim().slice(0, 100);
}

function parseMemberMinistries(ministries: string): MemberMinistry[] {
  const parsedMinistries = memberMinistriesSchema.safeParse(ministries.split(',').filter(Boolean));
  return parsedMinistries.success ? parsedMinistries.data : [];
}

function parseMemberPage(page: string): number {
  const parsedPage = Number(page);
  return Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
}

function parseMemberPageSize(pageSize: string): (typeof MEMBER_PAGE_SIZE_OPTIONS)[number] {
  const parsedPageSize = Number(pageSize);
  return MEMBER_PAGE_SIZE_OPTIONS.includes(
    parsedPageSize as (typeof MEMBER_PAGE_SIZE_OPTIONS)[number],
  )
    ? (parsedPageSize as (typeof MEMBER_PAGE_SIZE_OPTIONS)[number])
    : DEFAULT_MEMBER_PAGE_SIZE;
}
