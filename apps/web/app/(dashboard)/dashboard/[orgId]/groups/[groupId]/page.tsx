import { notFound } from 'next/navigation';
import { loadGroupAction } from '../actions';
import { GroupDetailManager } from './_components/group-detail-manager';

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string; orgId: string }>;
}) {
  const { groupId, orgId } = await params;
  const groupResult = await loadGroupAction({ organizationId: orgId, groupId });
  if (!groupResult.ok) notFound();

  return <GroupDetailManager initialPayload={groupResult.payload} organizationId={orgId} />;
}
