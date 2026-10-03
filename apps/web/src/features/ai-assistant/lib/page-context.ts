import { aiAssistantUiContextSchema } from '@churchflow/shared';
import { ORGANIZATION_ROUTE_SEGMENTS } from '@/features/organizations/routes';
import type { AiAssistantPageContext } from '../types/ai-assistant-view';

const entityIdSchema = aiAssistantUiContextSchema.shape.groupId.unwrap();

// A non-UUID segment would fail the whole chat request, so it is dropped instead of sent.
function entityIdFromSegment(segment: string | undefined): string | undefined {
  return segment && entityIdSchema.safeParse(segment).success ? segment : undefined;
}

/** What the user is looking at, so the assistant can resolve "here" and "this person". */
export function aiAssistantPageContext(pathname: string): AiAssistantPageContext {
  const [, root, organizationId, section, entitySegment] = pathname.split('/');

  if (root !== ORGANIZATION_ROUTE_SEGMENTS.dashboard || !organizationId) {
    return { module: 'other' };
  }

  const entityId = entityIdFromSegment(entitySegment);

  switch (section) {
    case undefined:
    case '':
      return { module: 'home' };
    case ORGANIZATION_ROUTE_SEGMENTS.members:
      return entityId ? { module: 'members', membershipId: entityId } : { module: 'members' };
    case ORGANIZATION_ROUTE_SEGMENTS.groups:
      return entityId ? { module: 'groups', groupId: entityId } : { module: 'groups' };
    case ORGANIZATION_ROUTE_SEGMENTS.calendar:
      return { module: 'calendar' };
    case ORGANIZATION_ROUTE_SEGMENTS.prayerRequests:
      return { module: 'prayerRequests' };
    case ORGANIZATION_ROUTE_SEGMENTS.budget:
      return { module: 'budget' };
    case ORGANIZATION_ROUTE_SEGMENTS.knowledge:
      return { module: 'knowledge' };
    default:
      return { module: 'other' };
  }
}
