import type { CalendarEventsService } from '../../calendar-events/calendar-events.service';
import type { GroupsService } from '../../groups/groups.service';
import type { MembershipsService } from '../../memberships/memberships.service';

/**
 * Names for the ids in a proposed action, so a confirmation reads "Add Maria to Youth" rather
 * than two uuids. Lookups go through the same services as the tools, so a confirmation never
 * shows a name the user could not have seen, and an unknown id simply stays unnamed.
 */
export class AiNameResolver {
  constructor(
    private readonly organizationId: string,
    private readonly userId: string,
    private readonly services: {
      groupsService: GroupsService;
      membershipsService: MembershipsService;
      calendarEventsService: CalendarEventsService;
    },
  ) {}

  async groupName(groupId: string): Promise<string | null> {
    try {
      const { group } = await this.services.groupsService.findById(
        this.organizationId,
        groupId,
        this.userId,
      );
      return group.name;
    } catch {
      return null;
    }
  }

  async memberName(membershipId: string): Promise<string | null> {
    try {
      const result = await this.services.membershipsService.listForOrganization(
        this.organizationId,
        this.userId,
        'all',
        'active',
        'all',
        '',
        [],
        1,
        10,
        membershipId,
      );
      return (
        result.members.find((member) => member.id === membershipId)?.profile.displayName ?? null
      );
    } catch {
      return null;
    }
  }

  async event(eventId: string): Promise<{ title: string; repeatPeriod: string } | null> {
    try {
      const event = await this.services.calendarEventsService.findItem(
        this.organizationId,
        eventId,
      );
      return { title: event.title, repeatPeriod: event.repeatPeriod };
    } catch {
      return null;
    }
  }
}
