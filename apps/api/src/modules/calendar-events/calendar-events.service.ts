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
import { CALENDAR_EVENT_TYPE, DEFAULT_CALENDAR_VISIBLE_EVENT_TYPES } from '@churchflow/shared';
import {
  CalendarEventsRepository,
  type CalendarEventRecord,
} from './repositories/calendar-events.repository';
import {
  CalendarRecurrenceError,
  expandCalendarEventOccurrences,
  getOccurrenceStarts,
  validTimeZoneOrFallback,
} from './recurrence/calendar-recurrence';
import { NotificationsService } from '../notifications/notifications.service';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const REMINDER_WINDOW_MS = 5 * 60 * 1000;
const REMINDER_LOOKAHEAD_MS = 7 * MILLISECONDS_PER_DAY;
const calendarEventsLogger = new Logger('CalendarEventsService');
type CalendarNotificationSchedule =
  | { kind: 'event'; offsetMs: 0 }
  | { kind: 'reminder'; offsetMs: number };

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
      await this.tryCreateServiceAssignedNotifications(organizationId, event, actorUserId);
      await this.tryCreateCalendarLinkedNotifications(organizationId, event, actorUserId);

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
        input.type === CALENDAR_EVENT_TYPE.task ||
        input.type === CALENDAR_EVENT_TYPE.service ||
        input.assigneeMembershipIds !== undefined ||
        input.serviceDetails !== undefined ||
        input.linkedMembershipId !== undefined
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
      await this.tryCreateServiceAssignedNotifications(organizationId, event, actorUserId, {
        previousParticipantMembershipIds:
          previousAssignmentSnapshot?.type === CALENDAR_EVENT_TYPE.service
            ? (previousAssignmentSnapshot.serviceDetails?.participants
                .map((participant) => participant.membershipId)
                .filter((membershipId): membershipId is string => Boolean(membershipId)) ?? [])
            : [],
        skipUnlessParticipantsChanged:
          previousAssignmentSnapshot?.type === CALENDAR_EVENT_TYPE.service &&
          input.serviceDetails === undefined,
      });
      await this.tryCreateCalendarLinkedNotifications(organizationId, event, actorUserId, {
        previousLinkedMembershipId: previousAssignmentSnapshot?.linkedMembershipId ?? null,
        skipUnlessLinkedMemberChanged:
          previousAssignmentSnapshot !== null && input.linkedMembershipId === undefined,
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

  async createDueReminderNotifications(now = new Date()) {
    const windowStart = new Date(now.getTime() - REMINDER_WINDOW_MS);
    const windowEnd = now;
    const candidateEnd = new Date(windowEnd.getTime() + REMINDER_LOOKAHEAD_MS);
    const events = await this.calendarEventsRepository.listReminderCandidates(
      windowStart,
      candidateEnd,
    );
    let createdCount = 0;
    let emailSentCount = 0;
    let telegramSentCount = 0;

    for (const event of events) {
      const creatorMembershipId = await this.calendarEventsRepository.findCreatorMembershipId(
        event.organizationId,
        event.createdByUserId,
      );
      const linkedRecipientMembershipIds = calendarReminderRecipientMembershipIds(
        event,
        creatorMembershipId,
      );
      const adminRecipientMembershipIds =
        await this.calendarEventsRepository.listAdminReminderRecipientMembershipIds(
          event.organizationId,
        );
      const recipientMemberships =
        await this.calendarEventsRepository.listReminderRecipientMemberships(event.organizationId, [
          ...linkedRecipientMembershipIds,
          ...adminRecipientMembershipIds,
        ]);
      const recipientsByTimeZone = groupReminderRecipientsByTimeZone(recipientMemberships);

      for (const [timeZone, recipientMembershipIds] of recipientsByTimeZone) {
        const schedules = notificationSchedules(event);
        const linkedRecipientMembershipIdSet = new Set(linkedRecipientMembershipIds);
        const adminRecipientMembershipIdSet = new Set(adminRecipientMembershipIds);

        for (const schedule of schedules) {
          const scheduledRecipientMembershipIds = calendarNotificationRecipientMembershipIds(
            recipientMembershipIds,
            linkedRecipientMembershipIdSet,
            adminRecipientMembershipIdSet,
            schedule.kind,
          );
          const occurrenceStarts = safeNotificationOccurrenceStarts(
            event,
            schedule.offsetMs,
            windowStart,
            windowEnd,
            timeZone,
          );
          if (occurrenceStarts.length === 0) continue;

          for (const occurrenceStart of occurrenceStarts) {
            if (scheduledRecipientMembershipIds.length === 0) continue;
            try {
              const result = await this.notificationsService.createCalendarReminderNotifications({
                organizationId: event.organizationId,
                actorUserId: null,
                recipientMembershipIds: scheduledRecipientMembershipIds,
                type: reminderNotificationType(event),
                preferenceKey: 'remindersEnabled',
                title: calendarNotificationTitle(event, schedule.kind),
                body: calendarNotificationBody(event, occurrenceStart, timeZone, schedule.kind),
                url: `/dashboard/${event.organizationId}/calendar`,
                entityType: 'CalendarEvent',
                entityId: event.id,
                dedupeKey: calendarNotificationDedupeKey(
                  event,
                  occurrenceStart,
                  timeZone,
                  schedule,
                ),
              });
              createdCount += result.createdCount;
              emailSentCount += result.emailSentCount;
              telegramSentCount += result.telegramSentCount;
            } catch (error: unknown) {
              calendarEventsLogger.error({
                event: 'Calendar notification creation failed',
                organizationId: event.organizationId,
                calendarEventId: event.id,
                occurrenceStart: occurrenceStart.toISOString(),
                schedule: schedule.kind,
                timeZone,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }
      }
    }

    return { eventsCount: events.length, createdCount, emailSentCount, telegramSentCount };
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

  private async tryCreateServiceAssignedNotifications(
    organizationId: string,
    event: CalendarEventRecord,
    actorUserId: string,
    options: {
      previousParticipantMembershipIds?: string[];
      skipUnlessParticipantsChanged?: boolean;
    } = {},
  ) {
    if (event.type !== CALENDAR_EVENT_TYPE.service) return;
    if (options.skipUnlessParticipantsChanged) return;

    const previousParticipantIds = new Set(options.previousParticipantMembershipIds ?? []);
    const participantMembershipIds = (event.serviceDetails?.participants ?? [])
      .map((participant) => participant.membershipId)
      .filter((membershipId): membershipId is string => Boolean(membershipId))
      .filter((membershipId) => !previousParticipantIds.has(membershipId));
    if (participantMembershipIds.length === 0) return;

    try {
      await this.notificationsService.createServiceAssignedNotifications({
        organizationId,
        actorUserId,
        eventId: event.id,
        title: 'You were assigned to a service',
        body: serviceAssignedNotificationBody(event),
        url: `/dashboard/${organizationId}/calendar`,
        participantMembershipIds,
      });
    } catch (error: unknown) {
      calendarEventsLogger.error({
        event: 'Service assignment notification creation failed',
        organizationId,
        calendarEventId: event.id,
        participantMembershipIds,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async tryCreateCalendarLinkedNotifications(
    organizationId: string,
    event: CalendarEventRecord,
    actorUserId: string,
    options: {
      previousLinkedMembershipId?: string | null;
      skipUnlessLinkedMemberChanged?: boolean;
    } = {},
  ) {
    if (options.skipUnlessLinkedMemberChanged) return;
    if (!event.linkedMembershipId) return;
    if (event.linkedMembershipId === options.previousLinkedMembershipId) return;

    try {
      await this.notificationsService.createCalendarLinkedNotifications({
        organizationId,
        actorUserId,
        recipientMembershipIds: [event.linkedMembershipId],
        type: 'CALENDAR_EVENT_LINKED',
        preferenceKey: 'organizationUpdatesEnabled',
        title: 'You were linked to a calendar event',
        body: `${event.title} starts at ${formatNotificationDateTime(event.startsAt)}.`,
        url: `/dashboard/${organizationId}/calendar`,
        entityType: 'CalendarEvent',
        entityId: event.id,
      });
    } catch (error: unknown) {
      calendarEventsLogger.error({
        event: 'Calendar linked-member notification creation failed',
        organizationId,
        calendarEventId: event.id,
        linkedMembershipId: event.linkedMembershipId,
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
  return `${event.title} starts at ${formatNotificationDateTime(event.startsAt)}.`;
}

function serviceAssignedNotificationBody(event: CalendarEventRecord): string {
  return `${event.title} starts at ${formatNotificationDateTime(event.startsAt)}.`;
}

function reminderNotificationTitle(event: CalendarEventRecord): string {
  if (event.type === CALENDAR_EVENT_TYPE.task) return 'Task reminder';
  if (event.type === CALENDAR_EVENT_TYPE.service) return 'Service reminder';
  return 'Calendar reminder';
}

function eventNotificationTitle(event: CalendarEventRecord): string {
  if (event.type === CALENDAR_EVENT_TYPE.task) return 'Task due';
  if (event.type === CALENDAR_EVENT_TYPE.service) return 'Service starts';
  if (event.type === CALENDAR_EVENT_TYPE.birthday) return 'Birthday';
  if (event.type === CALENDAR_EVENT_TYPE.anniversary) return 'Anniversary';
  return 'Calendar event';
}

function calendarNotificationTitle(
  event: CalendarEventRecord,
  scheduleKind: CalendarNotificationSchedule['kind'],
): string {
  return scheduleKind === 'reminder'
    ? reminderNotificationTitle(event)
    : eventNotificationTitle(event);
}

function calendarNotificationBody(
  event: CalendarEventRecord,
  occurrenceStart: Date,
  timeZone: string,
  scheduleKind: CalendarNotificationSchedule['kind'],
): string {
  if (scheduleKind === 'event') {
    return `${event.title} is scheduled for ${formatNotificationDateTime(occurrenceStart, timeZone)}.`;
  }

  return `${event.title} starts at ${formatNotificationDateTime(occurrenceStart, timeZone)}.`;
}

function reminderNotificationType(event: CalendarEventRecord) {
  if (event.type === CALENDAR_EVENT_TYPE.task) return 'TASK_DUE_REMINDER' as const;
  if (event.type === CALENDAR_EVENT_TYPE.service) return 'SERVICE_REMINDER' as const;
  return 'CALENDAR_EVENT_REMINDER' as const;
}

function calendarReminderRecipientMembershipIds(
  event: CalendarEventRecord,
  creatorMembershipId: string | null,
): string[] {
  return [
    creatorMembershipId,
    event.linkedMembershipId,
    ...event.assignees.map((assignee) => assignee.membershipId),
    ...(event.serviceDetails?.participants ?? []).map((participant) => participant.membershipId),
  ].filter((membershipId): membershipId is string => Boolean(membershipId));
}

function calendarNotificationRecipientMembershipIds(
  availableRecipientMembershipIds: string[],
  linkedRecipientMembershipIds: Set<string>,
  adminRecipientMembershipIds: Set<string>,
  scheduleKind: CalendarNotificationSchedule['kind'],
): string[] {
  return availableRecipientMembershipIds.filter((membershipId) => {
    if (linkedRecipientMembershipIds.has(membershipId)) return true;
    return scheduleKind === 'event' && adminRecipientMembershipIds.has(membershipId);
  });
}

function notificationSchedules(event: CalendarEventRecord): CalendarNotificationSchedule[] {
  return [
    { kind: 'event', offsetMs: 0 },
    ...(event.reminder
      ? [{ kind: 'reminder' as const, offsetMs: reminderOffsetMs(event.reminder) }]
      : []),
  ];
}

function safeNotificationOccurrenceStarts(
  event: CalendarEventRecord,
  notificationOffsetMs: number,
  windowStart: Date,
  windowEnd: Date,
  timeZone: string,
): Date[] {
  try {
    return getOccurrenceStarts({
      startsAt: event.startsAt,
      repeatPeriod: event.repeatPeriod,
      rangeStart: new Date(windowStart.getTime() + notificationOffsetMs),
      rangeEnd: new Date(windowEnd.getTime() + notificationOffsetMs),
      timeZone,
      includeRangeEnd: true,
    });
  } catch (error: unknown) {
    if (error instanceof CalendarRecurrenceError) {
      calendarEventsLogger.error({
        event: 'Calendar notification recurrence expansion failed',
        organizationId: event.organizationId,
        calendarEventId: event.id,
        code: error.code,
        context: error.context,
      });
      return [];
    }

    throw error;
  }
}

function calendarNotificationDedupeKey(
  event: CalendarEventRecord,
  occurrenceStart: Date,
  timeZone: string,
  schedule: CalendarNotificationSchedule,
): string {
  if (schedule.kind === 'reminder') {
    return `calendar-reminder:${event.id}:${String(schedule.offsetMs)}:${occurrenceStart.toISOString()}:${timeZone}`;
  }

  return `calendar-event:${event.id}:${occurrenceStart.toISOString()}:${timeZone}`;
}

function reminderOffsetMs(reminder: NonNullable<CalendarEventRecord['reminder']>): number {
  if (reminder === 'ONE_HOUR') return 60 * 60 * 1000;
  if (reminder === 'ONE_DAY') return MILLISECONDS_PER_DAY;
  return 7 * MILLISECONDS_PER_DAY;
}

function groupReminderRecipientsByTimeZone(
  recipients: Array<{ id: string; timeZone: string }>,
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const recipient of recipients) {
    const timeZone = validTimeZoneOrFallback(recipient.timeZone);
    const group = groups.get(timeZone) ?? [];
    group.push(recipient.id);
    groups.set(timeZone, group);
  }

  return groups;
}

function formatNotificationDateTime(value: Date, timeZone = 'Europe/Kyiv'): string {
  return new Intl.DateTimeFormat('uk-UA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: validTimeZoneOrFallback(timeZone),
  }).format(value);
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
  try {
    return expandCalendarEventOccurrences({
      event,
      rangeStart,
      rangeEnd,
      timeZone: 'Europe/Kyiv',
    }).map((occurrence) => {
      const item = baseEventToItem(event);
      item.occurrenceId = `${event.id}:${occurrence.startsAt.toISOString()}`;
      item.startsAt = occurrence.startsAt.toISOString();
      item.endsAt = occurrence.endsAt?.toISOString() ?? null;
      return item;
    });
  } catch (error: unknown) {
    if (error instanceof CalendarRecurrenceError) {
      calendarEventsLogger.error({
        event: 'Calendar recurrence expansion failed',
        organizationId: event.organizationId,
        calendarEventId: event.id,
        code: error.code,
        context: error.context,
      });
    }

    throw error;
  }
}
