import { Injectable } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import type {
  CalendarEventType,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from '@churchflow/shared';
import { CALENDAR_EVENT_REPEAT_PERIOD, CALENDAR_EVENT_TYPE } from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';

const calendarEventInclude = {
  linkedMembership: {
    include: {
      profile: true,
      user: { select: { displayName: true, email: true, avatarUrl: true } },
    },
  },
  imageAsset: { select: { id: true } },
  assignees: {
    include: {
      membership: {
        include: {
          profile: true,
          user: { select: { displayName: true, email: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

export type CalendarEventRecord = Prisma.CalendarEventGetPayload<{
  include: typeof calendarEventInclude;
}>;

@Injectable()
export class CalendarEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveMembership(organizationId: string, actorUserId: string) {
    return this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: actorUserId,
        status: 'ACTIVE',
        removedAt: null,
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true, role: true },
    });
  }

  async listMembers(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        removedAt: null,
      },
      include: {
        profile: true,
        user: { select: { displayName: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listForRange(
    organizationId: string,
    rangeStart: Date,
    rangeEnd: Date,
    types: CalendarEventType[],
  ): Promise<CalendarEventRecord[]> {
    return this.prisma.calendarEvent.findMany({
      where: {
        organizationId,
        deletedAt: null,
        type: { in: types },
        OR: [
          {
            repeatPeriod: CALENDAR_EVENT_REPEAT_PERIOD.none,
            startsAt: { lt: rangeEnd },
            OR: [{ endsAt: null, startsAt: { gte: rangeStart } }, { endsAt: { gte: rangeStart } }],
          },
          {
            repeatPeriod: { not: CALENDAR_EVENT_REPEAT_PERIOD.none },
            startsAt: { lt: rangeEnd },
          },
        ],
      },
      include: calendarEventInclude,
      orderBy: { startsAt: 'asc' },
    });
  }

  async getPreferences(organizationId: string, userId: string) {
    return this.prisma.calendarPreference.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { visibleEventTypes: true },
    });
  }

  async updatePreferences(
    organizationId: string,
    userId: string,
    visibleEventTypes: CalendarEventType[],
  ) {
    return this.prisma.calendarPreference.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      create: { organizationId, userId, visibleEventTypes },
      update: { visibleEventTypes },
      select: { visibleEventTypes: true },
    });
  }

  async create(organizationId: string, input: CreateCalendarEventInput, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManageableActor(tx, organizationId, actorUserId);
      await this.assertReferencesBelongToOrganization(tx, organizationId, input);

      const data: Prisma.CalendarEventUncheckedCreateInput = {
        organizationId,
        createdByUserId: actorUserId,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        allDay: input.allDay,
        reminder: input.reminder ?? null,
        repeatPeriod: input.repeatPeriod,
        linkedMembershipId: input.linkedMembershipId ?? null,
        imageAssetId: input.imageAssetId ?? null,
        taskCompleted: input.type === CALENDAR_EVENT_TYPE.task ? input.taskCompleted : false,
      };
      if (input.type === CALENDAR_EVENT_TYPE.task) {
        data.assignees = {
          createMany: {
            data: input.assigneeMembershipIds.map((membershipId) => ({ membershipId })),
          },
        };
      }

      const event = await tx.calendarEvent.create({
        data,
        include: calendarEventInclude,
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'CREATE_CALENDAR_EVENT',
          entityType: 'CalendarEvent',
          entityId: event.id,
          metadata: { type: input.type },
        },
      });

      return event;
    });
  }

  async update(
    organizationId: string,
    eventId: string,
    input: UpdateCalendarEventInput,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManageableActor(tx, organizationId, actorUserId);
      const existing = await tx.calendarEvent.findFirst({
        where: { id: eventId, organizationId, deletedAt: null },
        select: { id: true, type: true },
      });
      if (!existing) throw new Error('EVENT_NOT_FOUND');

      await this.assertReferencesBelongToOrganization(tx, organizationId, input);
      const nextType = input.type ?? existing.type;
      const assigneeMembershipIds =
        nextType === CALENDAR_EVENT_TYPE.task ? (input.assigneeMembershipIds ?? undefined) : [];

      if (Array.isArray(assigneeMembershipIds)) {
        await tx.calendarEventAssignee.deleteMany({ where: { eventId } });
        if (assigneeMembershipIds.length > 0) {
          await tx.calendarEventAssignee.createMany({
            data: assigneeMembershipIds.map((membershipId) => ({ eventId, membershipId })),
          });
        }
      }

      const event = await tx.calendarEvent.update({
        where: { id: eventId },
        data: {
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.startsAt !== undefined ? { startsAt: new Date(input.startsAt) } : {}),
          ...(input.endsAt !== undefined
            ? { endsAt: input.endsAt ? new Date(input.endsAt) : null }
            : {}),
          ...(input.allDay !== undefined ? { allDay: input.allDay } : {}),
          ...(input.reminder !== undefined ? { reminder: input.reminder } : {}),
          ...(input.repeatPeriod !== undefined ? { repeatPeriod: input.repeatPeriod } : {}),
          ...(input.linkedMembershipId !== undefined
            ? { linkedMembershipId: input.linkedMembershipId }
            : {}),
          ...(input.imageAssetId !== undefined ? { imageAssetId: input.imageAssetId } : {}),
          ...(input.taskCompleted !== undefined && nextType === CALENDAR_EVENT_TYPE.task
            ? { taskCompleted: input.taskCompleted }
            : nextType !== CALENDAR_EVENT_TYPE.task
              ? { taskCompleted: false }
              : {}),
        },
        include: calendarEventInclude,
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'UPDATE_CALENDAR_EVENT',
          entityType: 'CalendarEvent',
          entityId: event.id,
          metadata: { changedFields: Object.keys(input) },
        },
      });

      return event;
    });
  }

  async softDelete(organizationId: string, eventId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManageableActor(tx, organizationId, actorUserId);
      const event = await tx.calendarEvent.findFirst({
        where: { id: eventId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!event) throw new Error('EVENT_NOT_FOUND');

      await tx.calendarEvent.update({
        where: { id: eventId },
        data: { deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'DELETE_CALENDAR_EVENT',
          entityType: 'CalendarEvent',
          entityId: eventId,
          metadata: {},
        },
      });

      return { id: eventId };
    });
  }

  async toggleTaskCompletion(
    organizationId: string,
    eventId: string,
    completed: boolean,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertManageableActor(tx, organizationId, actorUserId);
      const event = await tx.calendarEvent.findFirst({
        where: { id: eventId, organizationId, type: CALENDAR_EVENT_TYPE.task, deletedAt: null },
        select: { id: true },
      });
      if (!event) throw new Error('TASK_NOT_FOUND');

      return tx.calendarEvent.update({
        where: { id: eventId },
        data: { taskCompleted: completed },
        include: calendarEventInclude,
      });
    });
  }

  private async assertManageableActor(
    tx: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
  ) {
    const actor = await tx.organizationMember.findFirst({
      where: {
        organizationId,
        userId: actorUserId,
        role: { in: ['OWNER', 'ADMIN'] },
        status: 'ACTIVE',
        removedAt: null,
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true },
    });
    if (!actor) throw new Error('ACTOR_CANNOT_MANAGE_CALENDAR');
  }

  private async assertReferencesBelongToOrganization(
    tx: Prisma.TransactionClient,
    organizationId: string,
    input: {
      linkedMembershipId?: string | null | undefined;
      assigneeMembershipIds?: string[] | undefined;
      imageAssetId?: string | null | undefined;
    },
  ) {
    const membershipIds = [
      ...(input.linkedMembershipId ? [input.linkedMembershipId] : []),
      ...(input.assigneeMembershipIds ?? []),
    ];

    if (membershipIds.length > 0) {
      const members = await tx.organizationMember.count({
        where: {
          organizationId,
          id: { in: [...new Set(membershipIds)] },
          status: 'ACTIVE',
          removedAt: null,
        },
      });
      if (members !== new Set(membershipIds).size) throw new Error('MEMBERSHIP_NOT_FOUND');
    }

    if (input.imageAssetId) {
      const asset = await tx.mediaAsset.findFirst({
        where: { id: input.imageAssetId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!asset) throw new Error('IMAGE_NOT_FOUND');
    }
  }
}
