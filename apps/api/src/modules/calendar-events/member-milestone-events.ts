import {
  CALENDAR_EVENT_REPEAT_PERIOD,
  CALENDAR_EVENT_TYPE,
  appLocaleOrFallback,
  type AppLocale,
} from '@churchflow/shared';
import type { Prisma } from '@churchflow/db';
import { zonedDateTimeToUtc } from './recurrence/calendar-recurrence';

export const MILESTONE_EVENT_TIME_ZONE = 'Europe/Kyiv';

type MilestoneEventType =
  | typeof CALENDAR_EVENT_TYPE.birthday
  | typeof CALENDAR_EVENT_TYPE.anniversary;

const MILESTONE_EVENT_TITLES = {
  en: {
    BIRTHDAY: (name: string) => `${name} birthday`,
    ANNIVERSARY: (name: string) => `${name} anniversary`,
  },
  uk: {
    BIRTHDAY: (name: string) => `День народження: ${name}`,
    ANNIVERSARY: (name: string) => `Річниця: ${name}`,
  },
} as const satisfies Record<AppLocale, Record<MilestoneEventType, (name: string) => string>>;

export interface MemberMilestoneEventSyncInput {
  organizationId: string;
  membershipId: string;
  displayName: string;
  birthday: Date | null;
  anniversary: Date | null;
  locale: AppLocale;
  actorUserId: string | null;
}

export async function syncMemberMilestoneEvents(
  tx: Prisma.TransactionClient,
  input: MemberMilestoneEventSyncInput,
): Promise<void> {
  await syncMilestoneEvent(tx, input, CALENDAR_EVENT_TYPE.birthday, input.birthday);
  await syncMilestoneEvent(tx, input, CALENDAR_EVENT_TYPE.anniversary, input.anniversary);
}

export async function milestoneActorLocale(
  tx: Prisma.TransactionClient,
  actorUserId: string | null,
): Promise<AppLocale> {
  if (!actorUserId) return appLocaleOrFallback(null);

  const actor = await tx.user.findUnique({
    where: { id: actorUserId },
    select: { locale: true },
  });

  return appLocaleOrFallback(actor?.locale);
}

async function syncMilestoneEvent(
  tx: Prisma.TransactionClient,
  input: MemberMilestoneEventSyncInput,
  type: MilestoneEventType,
  date: Date | null,
): Promise<void> {
  const existing = await tx.calendarEvent.findFirst({
    where: {
      organizationId: input.organizationId,
      linkedMembershipId: input.membershipId,
      type,
      deletedAt: null,
    },
    select: { id: true, startsAt: true },
  });

  if (!date) {
    if (existing) {
      await tx.calendarEvent.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
      await recordMilestoneAudit(tx, input, type, existing.id, 'deleted');
    }
    return;
  }

  const startsAt = milestoneEventStartsAt(date);

  if (existing) {
    if (existing.startsAt.getTime() === startsAt.getTime()) return;

    await tx.calendarEvent.update({
      where: { id: existing.id },
      data: { startsAt, allDay: true, repeatPeriod: CALENDAR_EVENT_REPEAT_PERIOD.yearly },
    });
    await recordMilestoneAudit(tx, input, type, existing.id, 'updated');
    return;
  }

  const created = await tx.calendarEvent.create({
    data: {
      organizationId: input.organizationId,
      linkedMembershipId: input.membershipId,
      type,
      title: MILESTONE_EVENT_TITLES[input.locale][type](input.displayName),
      startsAt,
      endsAt: null,
      allDay: true,
      repeatPeriod: CALENDAR_EVENT_REPEAT_PERIOD.yearly,
    },
    select: { id: true },
  });
  await recordMilestoneAudit(tx, input, type, created.id, 'created');
}

async function recordMilestoneAudit(
  tx: Prisma.TransactionClient,
  input: MemberMilestoneEventSyncInput,
  type: MilestoneEventType,
  eventId: string,
  change: 'created' | 'updated' | 'deleted',
): Promise<void> {
  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'SYNC_MEMBER_MILESTONE_EVENT',
      entityType: 'CalendarEvent',
      entityId: eventId,
      metadata: { type, change, membershipId: input.membershipId },
    },
  });
}

function milestoneEventStartsAt(date: Date): Date {
  return zonedDateTimeToUtc(
    {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    },
    MILESTONE_EVENT_TIME_ZONE,
  );
}
