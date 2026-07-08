import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  CalendarEventItem,
  CalendarEventMemberSummary,
  CalendarEventType,
  CreateCalendarEventInput,
  ListCalendarEventsQuery,
  UpdateCalendarEventInput,
} from '@churchflow/shared';
import {
  CALENDAR_EVENT_REPEAT_PERIOD,
  DEFAULT_CALENDAR_VISIBLE_EVENT_TYPES,
} from '@churchflow/shared';
import {
  CalendarEventsRepository,
  type CalendarEventRecord,
} from './repositories/calendar-events.repository';

@Injectable()
export class CalendarEventsService {
  constructor(private readonly calendarEventsRepository: CalendarEventsRepository) {}

  async listForOrganization(
    organizationId: string,
    actorUserId: string,
    query: ListCalendarEventsQuery,
  ) {
    const [actorMembership, preferences, members] = await Promise.all([
      this.calendarEventsRepository.findActiveMembership(organizationId, actorUserId),
      this.calendarEventsRepository.getPreferences(organizationId, actorUserId),
      this.calendarEventsRepository.listMembers(organizationId),
    ]);
    const visibleEventTypes = preferences?.visibleEventTypes ?? [
      ...DEFAULT_CALENDAR_VISIBLE_EVENT_TYPES,
    ];
    const requestedTypes = query.types ?? visibleEventTypes;
    const types = requestedTypes.filter((type) => visibleEventTypes.includes(type));
    const rangeStart = new Date(query.rangeStart);
    const rangeEnd = new Date(query.rangeEnd);
    const events = await this.calendarEventsRepository.listForRange(
      organizationId,
      rangeStart,
      rangeEnd,
      types,
    );

    return {
      actorRole: actorMembership?.role ?? null,
      canManage: actorMembership?.role === 'OWNER' || actorMembership?.role === 'ADMIN',
      preferences: { visibleEventTypes },
      members: members.map((member) => ({
        id: member.id,
        displayName:
          member.profile?.displayName ?? member.user?.displayName ?? member.user?.email ?? 'Member',
        birthday: formatDateOnly(member.profile?.birthday ?? null),
        anniversary: formatDateOnly(member.profile?.anniversary ?? null),
        photoAssetId: member.profile?.profilePhotoAssetId ?? null,
        photoUrl: member.user?.avatarUrl ?? null,
      })),
      events: events.flatMap((event) => expandEvent(event, rangeStart, rangeEnd)),
    };
  }

  async updatePreferences(
    organizationId: string,
    actorUserId: string,
    visibleEventTypes: CalendarEventType[],
  ) {
    const preferences = await this.calendarEventsRepository.updatePreferences(
      organizationId,
      actorUserId,
      visibleEventTypes,
    );

    return { visibleEventTypes: preferences.visibleEventTypes };
  }

  async create(organizationId: string, input: CreateCalendarEventInput, actorUserId: string) {
    try {
      return baseEventToItem(
        await this.calendarEventsRepository.create(organizationId, input, actorUserId),
      );
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async update(
    organizationId: string,
    eventId: string,
    input: UpdateCalendarEventInput,
    actorUserId: string,
  ) {
    try {
      return baseEventToItem(
        await this.calendarEventsRepository.update(organizationId, eventId, input, actorUserId),
      );
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async delete(organizationId: string, eventId: string, actorUserId: string) {
    try {
      return await this.calendarEventsRepository.softDelete(organizationId, eventId, actorUserId);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async toggleTaskCompletion(
    organizationId: string,
    eventId: string,
    completed: boolean,
    actorUserId: string,
  ) {
    try {
      return baseEventToItem(
        await this.calendarEventsRepository.toggleTaskCompletion(
          organizationId,
          eventId,
          completed,
          actorUserId,
        ),
      );
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private toHttpError(error: unknown) {
    if (!(error instanceof Error)) return error;
    if (error.message === 'ACTOR_CANNOT_MANAGE_CALENDAR') {
      return new ForbiddenException(
        'Only organization owners and admins can manage calendar events',
      );
    }
    if (error.message === 'EVENT_NOT_FOUND') return new NotFoundException('Event was not found');
    if (error.message === 'TASK_NOT_FOUND')
      return new NotFoundException('Task event was not found');
    if (error.message === 'MEMBERSHIP_NOT_FOUND') {
      return new UnprocessableEntityException('Selected member was not found');
    }
    if (error.message === 'IMAGE_NOT_FOUND') {
      return new UnprocessableEntityException('Selected event image was not found');
    }

    return error;
  }
}

function formatDateOnly(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function memberSummary(
  member:
    | CalendarEventRecord['linkedMembership']
    | CalendarEventRecord['assignees'][number]['membership']
    | null,
): CalendarEventMemberSummary | null {
  if (!member) return null;

  return {
    id: member.id,
    displayName:
      member.profile?.displayName ?? member.user?.displayName ?? member.user?.email ?? 'Member',
    photoAssetId: member.profile?.profilePhotoAssetId ?? null,
    photoUrl: member.user?.avatarUrl ?? null,
  };
}

function baseEventToItem(event: CalendarEventRecord): CalendarEventItem {
  return {
    id: event.id,
    occurrenceId: event.id,
    baseEventId: event.id,
    type: event.type,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    allDay: event.allDay,
    reminder: event.reminder,
    repeatPeriod: event.repeatPeriod,
    taskCompleted: event.taskCompleted,
    linkedMember: memberSummary(event.linkedMembership),
    assignees: event.assignees
      .map((assignee) => memberSummary(assignee.membership))
      .filter((member): member is CalendarEventMemberSummary => member !== null),
    image: event.imageAsset ? { id: event.imageAsset.id, url: null } : null,
  };
}

function expandEvent(
  event: CalendarEventRecord,
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEventItem[] {
  if (event.repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.none) {
    return overlaps(event.startsAt, event.endsAt, rangeStart, rangeEnd)
      ? [baseEventToItem(event)]
      : [];
  }

  const items: CalendarEventItem[] = [];
  const duration = event.endsAt ? event.endsAt.getTime() - event.startsAt.getTime() : null;
  const occurrenceSearchStart =
    duration === null ? rangeStart : new Date(rangeStart.getTime() - Math.max(duration, 0));
  let occurrenceStart = firstOccurrenceInRange(
    event.startsAt,
    event.repeatPeriod,
    occurrenceSearchStart,
  );
  let guard = 0;

  while (occurrenceStart < rangeEnd && guard < 500) {
    const occurrenceEnd = duration === null ? null : new Date(occurrenceStart.getTime() + duration);
    if (overlaps(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)) {
      const item = baseEventToItem(event);
      item.occurrenceId = `${event.id}:${occurrenceStart.toISOString()}`;
      item.startsAt = occurrenceStart.toISOString();
      item.endsAt = occurrenceEnd?.toISOString() ?? null;
      items.push(item);
    }
    occurrenceStart = nextOccurrence(occurrenceStart, event.repeatPeriod);
    guard += 1;
  }

  return items;
}

function firstOccurrenceInRange(
  startsAt: Date,
  repeatPeriod: CalendarEventRecord['repeatPeriod'],
  rangeStart: Date,
): Date {
  const occurrenceStart = new Date(startsAt);

  if (
    repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.daily ||
    repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.weekly
  ) {
    const intervalMs =
      repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.daily ? 86_400_000 : 604_800_000;
    const elapsedIntervals = Math.floor(
      (rangeStart.getTime() - occurrenceStart.getTime()) / intervalMs,
    );
    if (elapsedIntervals > 0) {
      occurrenceStart.setTime(occurrenceStart.getTime() + elapsedIntervals * intervalMs);
    }
    while (occurrenceStart < rangeStart) {
      occurrenceStart.setTime(occurrenceStart.getTime() + intervalMs);
    }
    return occurrenceStart;
  }

  let guard = 0;
  while (nextOccurrence(occurrenceStart, repeatPeriod) <= rangeStart && guard < 5000) {
    occurrenceStart.setTime(nextOccurrence(occurrenceStart, repeatPeriod).getTime());
    guard += 1;
  }

  return occurrenceStart;
}

function overlaps(start: Date, end: Date | null, rangeStart: Date, rangeEnd: Date): boolean {
  return start < rangeEnd && (end ?? start) >= rangeStart;
}

function nextOccurrence(value: Date, repeatPeriod: CalendarEventRecord['repeatPeriod']): Date {
  const next = new Date(value);
  if (repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.daily) next.setUTCDate(next.getUTCDate() + 1);
  if (repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.weekly) next.setUTCDate(next.getUTCDate() + 7);
  if (repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.monthly)
    next.setUTCMonth(next.getUTCMonth() + 1);
  if (repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.yearly)
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}
