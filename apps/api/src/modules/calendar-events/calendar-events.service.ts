import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  CalendarEventItem,
  CalendarEventMemberSummary,
  CalendarServiceDetails,
  CalendarServicePerson,
  CalendarEventType,
  CreateCalendarEventInput,
  ListCalendarEventsQuery,
  UpdateCalendarEventInput,
} from '@churchflow/shared';
import {
  CALENDAR_EVENT_TYPE,
  CALENDAR_EVENT_REPEAT_PERIOD,
  DEFAULT_CALENDAR_VISIBLE_EVENT_TYPES,
} from '@churchflow/shared';
import {
  CalendarEventsRepository,
  type CalendarEventRecord,
} from './repositories/calendar-events.repository';
import { NotificationsService } from '../notifications/notifications.service';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;
const DAILY_REPEAT_INTERVAL_MS = MILLISECONDS_PER_DAY;
const WEEKLY_REPEAT_INTERVAL_MS = DAYS_PER_WEEK * MILLISECONDS_PER_DAY;
const DAILY_REPEAT_STEP_DAYS = 1;
const WEEKLY_REPEAT_STEP_DAYS = DAYS_PER_WEEK;
const MONTHLY_REPEAT_STEP_MONTHS = 1;
const YEARLY_REPEAT_STEP_YEARS = 1;
const MAX_EXPANDED_OCCURRENCES_PER_EVENT = 500;
const MAX_OCCURRENCE_SEARCH_STEPS = 5000;
const calendarEventsLogger = new Logger('CalendarEventsService');

@Injectable()
export class CalendarEventsService {
  constructor(
    private readonly calendarEventsRepository: CalendarEventsRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

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
        ministries: member.ministries.map(({ ministry }) => ministry),
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
      const event = await this.calendarEventsRepository.create(organizationId, input, actorUserId);
      await this.tryCreateTaskAssignedNotifications(organizationId, event, actorUserId);

      return baseEventToItem(event);
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
      const previousAssignmentSnapshot =
        input.type === CALENDAR_EVENT_TYPE.task || input.assigneeMembershipIds !== undefined
          ? await this.calendarEventsRepository.getAssignmentSnapshot(organizationId, eventId)
          : null;
      const event = await this.calendarEventsRepository.update(
        organizationId,
        eventId,
        input,
        actorUserId,
      );
      await this.tryCreateTaskAssignedNotifications(organizationId, event, actorUserId, {
        previousAssigneeMembershipIds:
          previousAssignmentSnapshot?.type === CALENDAR_EVENT_TYPE.task
            ? previousAssignmentSnapshot.assignees.map((assignee) => assignee.membershipId)
            : [],
        skipUnlessAssigneesChanged:
          previousAssignmentSnapshot?.type === CALENDAR_EVENT_TYPE.task &&
          input.assigneeMembershipIds === undefined,
      });

      return baseEventToItem(event);
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

  private async tryCreateTaskAssignedNotifications(
    organizationId: string,
    event: CalendarEventRecord,
    actorUserId: string,
    options: {
      previousAssigneeMembershipIds?: string[];
      skipUnlessAssigneesChanged?: boolean;
    } = {},
  ) {
    if (event.type !== CALENDAR_EVENT_TYPE.task) return;
    if (options.skipUnlessAssigneesChanged) return;

    const previousAssigneeIds = new Set(options.previousAssigneeMembershipIds ?? []);
    const assigneeMembershipIds = event.assignees
      .map((assignee) => assignee.membershipId)
      .filter((membershipId) => !previousAssigneeIds.has(membershipId));
    if (assigneeMembershipIds.length === 0) return;

    try {
      await this.notificationsService.createTaskAssignedNotifications({
        organizationId,
        actorUserId,
        eventId: event.id,
        title: 'You were assigned a task',
        body: taskAssignedNotificationBody(event),
        url: `/dashboard/${organizationId}/calendar`,
        assigneeMembershipIds,
      });
    } catch (error: unknown) {
      calendarEventsLogger.error({
        event: 'Task assignment notification creation failed',
        organizationId,
        calendarEventId: event.id,
        assigneeMembershipIds,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function formatDateOnly(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function taskAssignedNotificationBody(event: CalendarEventRecord): string {
  return `${event.title} starts at ${event.startsAt.toISOString()}.`;
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
    serviceDetails: serviceDetailsSummary(event.serviceDetails),
  };
}

function servicePersonSummary(
  participant: NonNullable<CalendarEventRecord['serviceDetails']>['participants'][number],
): CalendarServicePerson {
  return {
    membershipId: participant.membershipId,
    customName: participant.customName,
    displayName:
      participant.displayNameSnapshot ??
      participant.membership?.profile?.displayName ??
      participant.membership?.user?.displayName ??
      participant.membership?.user?.email ??
      participant.customName ??
      'Guest',
    photoAssetId: participant.membership?.profile?.profilePhotoAssetId ?? null,
    photoUrl: participant.membership?.user?.avatarUrl ?? null,
  };
}

function serviceDetailsSummary(
  details: CalendarEventRecord['serviceDetails'],
): CalendarServiceDetails | null {
  if (!details) return null;
  const participants = new Map(
    details.participants.map((participant) => [
      participant.role,
      servicePersonSummary(participant),
    ]),
  );

  return {
    hasCommunion: details.hasCommunion,
    biblePassage: details.biblePassage,
    preacher: participants.get('PREACHER') ?? null,
    serviceHost: participants.get('SERVICE_HOST') ?? null,
    worshipLead: participants.get('WORSHIP_LEAD') ?? null,
    communionLead: participants.get('COMMUNION_LEAD') ?? null,
    songs: details.songs.map((song) => song.title),
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
    event.id,
    event.startsAt,
    event.repeatPeriod,
    occurrenceSearchStart,
  );
  let guard = 0;

  while (occurrenceStart < rangeEnd && guard < MAX_EXPANDED_OCCURRENCES_PER_EVENT) {
    const occurrenceEnd = duration === null ? null : new Date(occurrenceStart.getTime() + duration);
    if (overlaps(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)) {
      const item = baseEventToItem(event);
      item.occurrenceId = `${event.id}:${occurrenceStart.toISOString()}`;
      item.startsAt = occurrenceStart.toISOString();
      item.endsAt = occurrenceEnd?.toISOString() ?? null;
      items.push(item);
    }
    occurrenceStart = nextOccurrenceAfter(event.id, occurrenceStart, event.repeatPeriod);
    guard += 1;
  }

  if (occurrenceStart < rangeEnd) {
    logRepeatWarning('Stopped expanding repeated calendar event after hitting occurrence limit', {
      eventId: event.id,
      repeatPeriod: event.repeatPeriod,
      maxOccurrences: MAX_EXPANDED_OCCURRENCES_PER_EVENT,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      lastOccurrenceStart: occurrenceStart.toISOString(),
    });
  }

  return items;
}

function firstOccurrenceInRange(
  eventId: string,
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
      repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.daily
        ? DAILY_REPEAT_INTERVAL_MS
        : WEEKLY_REPEAT_INTERVAL_MS;
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
  while (guard < MAX_OCCURRENCE_SEARCH_STEPS) {
    const next = nextOccurrenceAfter(eventId, occurrenceStart, repeatPeriod);
    if (next > rangeStart) return occurrenceStart;

    occurrenceStart.setTime(next.getTime());
    guard += 1;
  }

  logRepeatError('Could not find first repeated calendar occurrence within search limit', {
    eventId,
    repeatPeriod,
    startsAt: startsAt.toISOString(),
    rangeStart: rangeStart.toISOString(),
    maxSearchSteps: MAX_OCCURRENCE_SEARCH_STEPS,
    lastOccurrenceStart: occurrenceStart.toISOString(),
  });
  throw new Error('CALENDAR_REPEAT_SEARCH_LIMIT_REACHED');
}

function overlaps(start: Date, end: Date | null, rangeStart: Date, rangeEnd: Date): boolean {
  return start < rangeEnd && (end ?? start) >= rangeStart;
}

function nextOccurrence(value: Date, repeatPeriod: CalendarEventRecord['repeatPeriod']): Date {
  const next = new Date(value);
  if (repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.daily)
    next.setUTCDate(next.getUTCDate() + DAILY_REPEAT_STEP_DAYS);
  if (repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.weekly)
    next.setUTCDate(next.getUTCDate() + WEEKLY_REPEAT_STEP_DAYS);
  if (repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.monthly)
    next.setUTCMonth(next.getUTCMonth() + MONTHLY_REPEAT_STEP_MONTHS);
  if (repeatPeriod === CALENDAR_EVENT_REPEAT_PERIOD.yearly)
    next.setUTCFullYear(next.getUTCFullYear() + YEARLY_REPEAT_STEP_YEARS);
  return next;
}

function nextOccurrenceAfter(
  eventId: string,
  value: Date,
  repeatPeriod: CalendarEventRecord['repeatPeriod'],
): Date {
  const next = nextOccurrence(value, repeatPeriod);
  if (next <= value) {
    logRepeatError('Calendar repeat calculation did not advance occurrence date', {
      eventId,
      repeatPeriod,
      currentOccurrenceStart: value.toISOString(),
      nextOccurrenceStart: next.toISOString(),
    });
    throw new Error('CALENDAR_REPEAT_DID_NOT_ADVANCE');
  }

  return next;
}

function logRepeatWarning(message: string, context: Record<string, unknown>) {
  calendarEventsLogger.warn(`${message}: ${JSON.stringify(context)}`);
}

function logRepeatError(message: string, context: Record<string, unknown>) {
  calendarEventsLogger.error(`${message}: ${JSON.stringify(context)}`);
}
