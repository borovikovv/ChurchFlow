import { createHash } from 'node:crypto';
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
  zonedDateParts,
  zonedDateTimeToUtc,
} from './recurrence/calendar-recurrence';
import { validTimeZoneOrFallback } from '../../common/time/date-time';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  NotificationBodyMessage,
  NotificationTitleKey,
} from '../notifications/notification-messages';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const NOTIFICATION_FALLBACK_TIME_ZONE = 'Europe/Kyiv';
const REMINDER_WINDOW_MS = 5 * 60 * 1000;
const REMINDER_LOOKAHEAD_MS = 7 * MILLISECONDS_PER_DAY;
const ALL_DAY_NOTIFICATION_HOUR = 9;
const ALL_DAY_OCCURRENCE_PADDING_MS = MILLISECONDS_PER_DAY;
const calendarEventsLogger = new Logger('CalendarEventsService');
interface MilestoneDigest {
  date: string;
  birthdays: string[];
  anniversaries: string[];
}
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
      const notifiedMembershipIds = new Set<string>([
        ...(await this.tryCreateTaskAssignedNotifications(organizationId, event, actorUserId)),
        ...(await this.tryCreateServiceAssignedNotifications(organizationId, event, actorUserId)),
      ]);
      await this.tryCreateCalendarLinkedNotifications(organizationId, event, actorUserId, {
        excludeMembershipIds: notifiedMembershipIds,
      });

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
      const taskAssignedMembershipIds = await this.tryCreateTaskAssignedNotifications(
        organizationId,
        event,
        actorUserId,
        {
          previousAssigneeMembershipIds:
            previousAssignmentSnapshot?.type === CALENDAR_EVENT_TYPE.task
              ? previousAssignmentSnapshot.assignees.map((assignee) => assignee.membershipId)
              : [],
          skipUnlessAssigneesChanged:
            previousAssignmentSnapshot?.type === CALENDAR_EVENT_TYPE.task &&
            input.assigneeMembershipIds === undefined,
        },
      );
      const serviceAssignedMembershipIds = await this.tryCreateServiceAssignedNotifications(
        organizationId,
        event,
        actorUserId,
        {
          previousParticipantMembershipIds:
            previousAssignmentSnapshot?.type === CALENDAR_EVENT_TYPE.service
              ? (previousAssignmentSnapshot.serviceDetails?.participants
                  .map((participant) => participant.membershipId)
                  .filter((membershipId): membershipId is string => Boolean(membershipId)) ?? [])
              : [],
          skipUnlessParticipantsChanged:
            previousAssignmentSnapshot?.type === CALENDAR_EVENT_TYPE.service &&
            input.serviceDetails === undefined,
        },
      );
      const notifiedMembershipIds = new Set<string>([
        ...taskAssignedMembershipIds,
        ...serviceAssignedMembershipIds,
      ]);
      await this.tryCreateCalendarLinkedNotifications(organizationId, event, actorUserId, {
        previousLinkedMembershipId: previousAssignmentSnapshot?.linkedMembershipId ?? null,
        skipUnlessLinkedMemberChanged:
          previousAssignmentSnapshot !== null && input.linkedMembershipId === undefined,
        excludeMembershipIds: notifiedMembershipIds,
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
      if (isBirthdayOrAnniversaryEvent(event.type)) continue;

      const creatorMembershipId = await this.calendarEventsRepository.findCreatorMembershipId(
        event.organizationId,
        event.createdByUserId,
      );
      const linkedRecipientMembershipIds = calendarReminderRecipientMembershipIds(
        event,
        creatorMembershipId,
      );
      const adminRecipientMembershipIds =
        await this.calendarEventsRepository.listAdminNotificationRecipientMembershipIds(
          event.organizationId,
        );
      const calendarEventRecipientMembershipIds =
        await this.calendarEventsRepository.listCalendarEventNotificationRecipientMembershipIds(
          event.organizationId,
        );
      const recipientMemberships =
        await this.calendarEventsRepository.listReminderRecipientMemberships(event.organizationId, [
          ...linkedRecipientMembershipIds,
          ...adminRecipientMembershipIds,
          ...calendarEventRecipientMembershipIds,
        ]);
      const recipientsByTimeZone = groupReminderRecipientsByTimeZone(recipientMemberships);

      for (const [timeZone, recipientMembershipIds] of recipientsByTimeZone) {
        const schedules = notificationSchedules(event);
        const linkedRecipientMembershipIdSet = new Set(linkedRecipientMembershipIds);
        const adminRecipientMembershipIdSet = new Set(adminRecipientMembershipIds);
        const calendarEventRecipientMembershipIdSet = new Set(calendarEventRecipientMembershipIds);

        for (const schedule of schedules) {
          const scheduledRecipientMembershipIds = calendarNotificationRecipientMembershipIds(
            recipientMembershipIds,
            linkedRecipientMembershipIdSet,
            adminRecipientMembershipIdSet,
            calendarEventRecipientMembershipIdSet,
            schedule.kind,
            event.type,
          );
          const occurrenceStarts = notificationOccurrenceStarts(
            event,
            schedule,
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
                titleKey: calendarNotificationTitleKey(event, schedule.kind),
                bodyMessage: calendarNotificationBody(
                  event,
                  occurrenceStart,
                  timeZone,
                  schedule.kind,
                ),
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

    const digests = await this.createMilestoneDigestNotifications(
      events.filter(
        (event) => isBirthdayOrAnniversaryEvent(event.type) && hasCelebratableMember(event),
      ),
      now,
    );

    return {
      eventsCount: events.length,
      createdCount: createdCount + digests.createdCount,
      emailSentCount: emailSentCount + digests.emailSentCount,
      telegramSentCount: telegramSentCount + digests.telegramSentCount,
    };
  }

  private async createMilestoneDigestNotifications(
    milestoneEvents: CalendarEventRecord[],
    now: Date,
  ) {
    let createdCount = 0;
    let emailSentCount = 0;
    let telegramSentCount = 0;

    for (const [organizationId, organizationEvents] of groupEventsByOrganization(milestoneEvents)) {
      const recipientMembershipIds =
        await this.calendarEventsRepository.listCalendarEventNotificationRecipientMembershipIds(
          organizationId,
        );
      const recipientMemberships =
        await this.calendarEventsRepository.listReminderRecipientMemberships(
          organizationId,
          recipientMembershipIds,
        );

      for (const [timeZone, membershipIds] of groupReminderRecipientsByTimeZone(
        recipientMemberships,
      )) {
        const digest = collectMilestoneDigest(organizationEvents, now, timeZone);
        if (!digest) continue;

        try {
          const result = await this.notificationsService.createCalendarReminderNotifications({
            organizationId,
            actorUserId: null,
            recipientMembershipIds: membershipIds,
            type: 'BIRTHDAY_DIGEST',
            preferenceKey: 'birthdayDigestEnabled',
            titleKey: milestoneDigestTitleKey(digest),
            bodyMessage: {
              key: 'birthdayDigest',
              birthdays: digest.birthdays,
              anniversaries: digest.anniversaries,
            },
            url: `/dashboard/${organizationId}/calendar`,
            dedupeKey: milestoneDigestDedupeKey(digest, timeZone),
          });
          createdCount += result.createdCount;
          emailSentCount += result.emailSentCount;
          telegramSentCount += result.telegramSentCount;
        } catch (error: unknown) {
          calendarEventsLogger.error({
            event: 'Milestone digest notification creation failed',
            organizationId,
            digestDate: digest.date,
            timeZone,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return { createdCount, emailSentCount, telegramSentCount };
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
  ): Promise<string[]> {
    if (event.type !== CALENDAR_EVENT_TYPE.task) return [];
    if (options.skipUnlessAssigneesChanged) return [];

    const previousAssigneeIds = new Set(options.previousAssigneeMembershipIds ?? []);
    const assigneeMembershipIds = event.assignees
      .map((assignee) => assignee.membershipId)
      .filter((membershipId) => !previousAssigneeIds.has(membershipId));
    if (assigneeMembershipIds.length === 0) return [];

    try {
      const result = await this.notificationsService.createTaskAssignedNotifications({
        organizationId,
        actorUserId,
        eventId: event.id,
        titleKey: 'taskAssigned',
        bodyMessage: eventStartsAtBody(event),
        url: `/dashboard/${organizationId}/calendar`,
        assigneeMembershipIds,
      });

      return result.notifiedMembershipIds;
    } catch (error: unknown) {
      calendarEventsLogger.error({
        event: 'Task assignment notification creation failed',
        organizationId,
        calendarEventId: event.id,
        assigneeMembershipIds,
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
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
  ): Promise<string[]> {
    if (event.type !== CALENDAR_EVENT_TYPE.service) return [];
    if (options.skipUnlessParticipantsChanged) return [];

    const previousParticipantIds = new Set(options.previousParticipantMembershipIds ?? []);
    const participantMembershipIds = (event.serviceDetails?.participants ?? [])
      .map((participant) => participant.membershipId)
      .filter((membershipId): membershipId is string => Boolean(membershipId))
      .filter((membershipId) => !previousParticipantIds.has(membershipId));
    if (participantMembershipIds.length === 0) return [];

    try {
      const result = await this.notificationsService.createServiceAssignedNotifications({
        organizationId,
        actorUserId,
        eventId: event.id,
        titleKey: 'serviceAssigned',
        bodyMessage: eventStartsAtBody(event),
        url: `/dashboard/${organizationId}/calendar`,
        participantMembershipIds,
      });

      return result.notifiedMembershipIds;
    } catch (error: unknown) {
      calendarEventsLogger.error({
        event: 'Service assignment notification creation failed',
        organizationId,
        calendarEventId: event.id,
        participantMembershipIds,
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  }

  private async tryCreateCalendarLinkedNotifications(
    organizationId: string,
    event: CalendarEventRecord,
    actorUserId: string,
    options: {
      previousLinkedMembershipId?: string | null;
      skipUnlessLinkedMemberChanged?: boolean;
      excludeMembershipIds?: ReadonlySet<string>;
    } = {},
  ) {
    if (options.skipUnlessLinkedMemberChanged) return;
    if (!event.linkedMembershipId) return;
    if (event.linkedMembershipId === options.previousLinkedMembershipId) return;

    try {
      const excludedMembershipIds = options.excludeMembershipIds ?? new Set<string>();
      const recipientMembershipIds = (
        await this.calendarEventsRepository.listAdminNotificationRecipientMembershipIds(
          organizationId,
        )
      ).filter((membershipId) => !excludedMembershipIds.has(membershipId));
      if (recipientMembershipIds.length === 0) return;

      await this.notificationsService.createCalendarLinkedNotifications({
        organizationId,
        actorUserId,
        recipientMembershipIds,
        type: 'CALENDAR_EVENT_LINKED',
        preferenceKey: 'organizationUpdatesEnabled',
        titleKey: 'calendarEventLinked',
        bodyMessage: calendarLinkedNotificationBody(event),
        url: `/dashboard/${organizationId}/calendar`,
        entityType: 'CalendarEvent',
        entityId: event.id,
        adminOnly: true,
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

function eventStartsAtBody(event: CalendarEventRecord): NotificationBodyMessage {
  return {
    key: 'eventStartsAt',
    eventTitle: event.title,
    startsAt: event.startsAt.toISOString(),
    timeZone: NOTIFICATION_FALLBACK_TIME_ZONE,
  };
}

function calendarLinkedNotificationBody(event: CalendarEventRecord): NotificationBodyMessage {
  return {
    key: 'calendarEventLinked',
    memberName: event.linkedMembership ? memberDisplayName(event.linkedMembership) : null,
    eventTitle: event.title,
    startsAt: event.startsAt.toISOString(),
    timeZone: NOTIFICATION_FALLBACK_TIME_ZONE,
  };
}

function memberDisplayName(
  member: NonNullable<CalendarEventRecord['linkedMembership']>,
): string | null {
  return member.profile?.displayName ?? member.user?.displayName ?? member.user?.email ?? null;
}

function reminderNotificationTitleKey(event: CalendarEventRecord): NotificationTitleKey {
  if (event.type === CALENDAR_EVENT_TYPE.task) return 'taskReminder';
  if (event.type === CALENDAR_EVENT_TYPE.service) return 'serviceReminder';
  return 'calendarReminder';
}

function eventNotificationTitleKey(event: CalendarEventRecord): NotificationTitleKey {
  if (event.type === CALENDAR_EVENT_TYPE.task) return 'taskDue';
  if (event.type === CALENDAR_EVENT_TYPE.service) return 'serviceStarts';
  if (event.type === CALENDAR_EVENT_TYPE.birthday) return 'birthday';
  if (event.type === CALENDAR_EVENT_TYPE.anniversary) return 'anniversary';
  return 'calendarEvent';
}

function calendarNotificationTitleKey(
  event: CalendarEventRecord,
  scheduleKind: CalendarNotificationSchedule['kind'],
): NotificationTitleKey {
  return scheduleKind === 'reminder'
    ? reminderNotificationTitleKey(event)
    : eventNotificationTitleKey(event);
}

function calendarNotificationBody(
  event: CalendarEventRecord,
  occurrenceStart: Date,
  timeZone: string,
  scheduleKind: CalendarNotificationSchedule['kind'],
): NotificationBodyMessage {
  if (usesAllDayNotificationTime(event)) {
    return {
      key: 'eventOnDate',
      eventTitle: event.title,
      startsAt: occurrenceStart.toISOString(),
      timeZone: NOTIFICATION_FALLBACK_TIME_ZONE,
    };
  }

  return {
    key: scheduleKind === 'event' ? 'eventScheduledFor' : 'eventStartsAt',
    eventTitle: event.title,
    startsAt: occurrenceStart.toISOString(),
    timeZone,
  };
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
  calendarEventRecipientMembershipIds: Set<string>,
  scheduleKind: CalendarNotificationSchedule['kind'],
  eventType: CalendarEventRecord['type'],
): string[] {
  return availableRecipientMembershipIds.filter((membershipId) => {
    if (isBirthdayOrAnniversaryEvent(eventType)) return false;
    if (linkedRecipientMembershipIds.has(membershipId)) return true;
    if (scheduleKind !== 'event') return false;
    if (eventType === CALENDAR_EVENT_TYPE.task) {
      return adminRecipientMembershipIds.has(membershipId);
    }

    return calendarEventRecipientMembershipIds.has(membershipId);
  });
}

function isBirthdayOrAnniversaryEvent(eventType: CalendarEventRecord['type']): boolean {
  return (
    eventType === CALENDAR_EVENT_TYPE.birthday || eventType === CALENDAR_EVENT_TYPE.anniversary
  );
}

function milestoneDigestTitleKey(digest: MilestoneDigest): NotificationTitleKey {
  if (digest.birthdays.length > 0 && digest.anniversaries.length > 0) {
    return 'birthdayDigestBirthdaysAndAnniversaries';
  }
  if (digest.anniversaries.length > 0) return 'birthdayDigestAnniversaries';

  return 'birthdayDigestBirthdays';
}

function collectMilestoneDigest(
  events: CalendarEventRecord[],
  now: Date,
  timeZone: string,
): MilestoneDigest | null {
  if (now < allDayNotificationInstant(now, timeZone)) return null;

  const digestDate = milestoneDigestDate(now);
  const birthdays: string[] = [];
  const anniversaries: string[] = [];

  for (const event of events) {
    if (!celebratesOnDigestDate(event, now, digestDate, timeZone)) continue;

    const name = milestoneMemberName(event);
    if (event.type === CALENDAR_EVENT_TYPE.birthday) birthdays.push(name);
    else anniversaries.push(name);
  }

  if (birthdays.length === 0 && anniversaries.length === 0) return null;

  return {
    date: digestDate,
    birthdays: birthdays.sort((left, right) => left.localeCompare(right)),
    anniversaries: anniversaries.sort((left, right) => left.localeCompare(right)),
  };
}

function celebratesOnDigestDate(
  event: CalendarEventRecord,
  now: Date,
  digestDate: string,
  timeZone: string,
): boolean {
  const occurrenceStarts = safeNotificationOccurrenceStarts(
    event,
    0,
    new Date(now.getTime() - ALL_DAY_OCCURRENCE_PADDING_MS),
    new Date(now.getTime() + ALL_DAY_OCCURRENCE_PADDING_MS),
    timeZone,
  );

  return occurrenceStarts.some(
    (occurrenceStart) => milestoneDigestDate(occurrenceStart) === digestDate,
  );
}

function milestoneDigestDedupeKey(digest: MilestoneDigest, timeZone: string): string {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([digest.birthdays, digest.anniversaries]))
    .digest('hex')
    .slice(0, 12);

  return `birthday-digest:${digest.date}:${timeZone}:${fingerprint}`;
}

function hasCelebratableMember(event: CalendarEventRecord): boolean {
  const membership = event.linkedMembership;
  if (!membership) return true;

  return membership.status === 'ACTIVE' && membership.removedAt === null;
}

function milestoneMemberName(event: CalendarEventRecord): string {
  return (event.linkedMembership ? memberDisplayName(event.linkedMembership) : null) ?? event.title;
}

function milestoneDigestDate(occurrenceStart: Date): string {
  const parts = zonedDateParts(occurrenceStart, NOTIFICATION_FALLBACK_TIME_ZONE);

  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

function groupEventsByOrganization(
  events: CalendarEventRecord[],
): Map<string, CalendarEventRecord[]> {
  const groups = new Map<string, CalendarEventRecord[]>();

  for (const event of events) {
    const group = groups.get(event.organizationId) ?? [];
    group.push(event);
    groups.set(event.organizationId, group);
  }

  return groups;
}

function notificationSchedules(event: CalendarEventRecord): CalendarNotificationSchedule[] {
  return [
    { kind: 'event', offsetMs: 0 },
    ...(event.reminder
      ? [{ kind: 'reminder' as const, offsetMs: reminderOffsetMs(event.reminder) }]
      : []),
  ];
}

function notificationOccurrenceStarts(
  event: CalendarEventRecord,
  schedule: CalendarNotificationSchedule,
  windowStart: Date,
  windowEnd: Date,
  timeZone: string,
): Date[] {
  if (!usesAllDayNotificationTime(event)) {
    return safeNotificationOccurrenceStarts(
      event,
      schedule.offsetMs,
      windowStart,
      windowEnd,
      timeZone,
    );
  }

  const candidates = safeNotificationOccurrenceStarts(
    event,
    schedule.offsetMs,
    new Date(windowStart.getTime() - ALL_DAY_OCCURRENCE_PADDING_MS),
    new Date(windowEnd.getTime() + ALL_DAY_OCCURRENCE_PADDING_MS),
    timeZone,
  );

  return candidates.filter((occurrenceStart) => {
    const notifyAt = new Date(
      allDayNotificationInstant(occurrenceStart, timeZone).getTime() - schedule.offsetMs,
    );

    return notifyAt >= windowStart && notifyAt <= windowEnd;
  });
}

function usesAllDayNotificationTime(event: CalendarEventRecord): boolean {
  return event.allDay || isBirthdayOrAnniversaryEvent(event.type);
}

function allDayNotificationInstant(occurrenceStart: Date, timeZone: string): Date {
  const parts = zonedDateParts(occurrenceStart, NOTIFICATION_FALLBACK_TIME_ZONE);

  return zonedDateTimeToUtc(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: ALL_DAY_NOTIFICATION_HOUR,
      minute: 0,
      second: 0,
    },
    timeZone,
  );
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
