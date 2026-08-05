import { notFound } from 'next/navigation';
import { MemberDetail } from '../_components/member-detail';
import {
  confirmMemberPhotoAction,
  createRelationshipAction,
  deleteRelationshipAction,
  loadMemberDetailsAction,
  prepareMemberPhotoAction,
  updateMemberProfileAction,
} from '../actions';

export default async function MemberDetailsPage({
  params,
}: {
  params: Promise<{ memberId: string; orgId: string }>;
}) {
  const { memberId, orgId } = await params;
  const result = await loadMemberDetailsAction({
    organizationId: orgId,
    membershipId: memberId,
  });

  if (!result.ok) notFound();

  return (
    <MemberDetail
      member={result.member}
      organizationId={orgId}
      payload={result.payload}
      action={updateMemberProfileAction}
      createRelationship={createRelationshipAction}
      deleteRelationship={deleteRelationshipAction}
      preparePhoto={prepareMemberPhotoAction}
      confirmPhoto={confirmMemberPhotoAction}
    />
  );
}
