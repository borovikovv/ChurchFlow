import { getCurrentUser } from '@/auth/session';
import { CopyField } from '@/components/copy-field';
import { getMessages } from '@/i18n/messages';
import { MembersManager } from './_components/members-manager';
import {
  claimAction,
  confirmMemberPhotoAction,
  createRelationshipAction,
  deleteRelationshipAction,
  loadMembersAction,
  manageInlineInvitationAction,
  prepareMemberPhotoAction,
  removeMemberAction,
  updateMemberRoleAction,
  updateMemberProfileAction,
} from './actions';
import type { MembersPayload } from './types';
import {
  organizationMembersAccessFilterSchema,
  type OrganizationMembersAccessFilter,
} from '@churchflow/shared';

type MembersSearchParams = {
  access?: string;
  claimLink?: string;
  error?: string;
  message?: string;
};

const emptyMembersPayload: MembersPayload = {
  actorRole: null,
  actorMembershipId: null,
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
  const { claimLink, message, error, access = 'all' } = await searchParams;
  const user = await getCurrentUser();
  const messages = getMessages(user?.locale ?? 'en');
  const memberAccess = parseMemberAccess(access);
  const membersResult = await loadMembersAction({ organizationId: orgId, access: memberAccess });
  const payload = membersResult.ok ? membersResult.payload : emptyMembersPayload;

  return (
    <div className="stack">
      <h1>{messages.members.title}</h1>
      <p>
        {messages.members.yourRole.replace(
          '{role}',
          payload.actorRole
            ? messages.members.roleLabels[payload.actorRole]
            : messages.members.platformAdministrator,
        )}
      </p>
      {!membersResult.ok ? <p className="form-error">{membersResult.error}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      {claimLink ? <CopyField value={claimLink} /> : null}

      <MembersManager
        key={memberAccess}
        memberAccess={memberAccess}
        organizationId={orgId}
        initialPayload={payload}
        manageInvitation={manageInlineInvitationAction}
        updateProfile={updateMemberProfileAction}
        updateRole={updateMemberRoleAction}
        removeMember={removeMemberAction}
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
