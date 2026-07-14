import { Injectable } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import type {
  ListNotificationsQuery,
  UpdateNotificationPreferencesInput,
} from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';

const notificationSelect = {
  id: true,
  organizationId: true,
  type: true,
  title: true,
  body: true,
  url: true,
  entityType: true,
  entityId: true,
  readAt: true,
  createdAt: true,
} as const;

const notificationDetailCalendarEventSelect = {
  id: true,
  type: true,
  title: true,
  description: true,
  startsAt: true,
  endsAt: true,
  allDay: true,
  assignees: {
    include: {
      membership: {
        include: {
          profile: true,
          user: { select: { displayName: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  serviceDetails: {
    include: {
      participants: {
        include: {
          membership: {
            include: {
              profile: true,
              user: { select: { displayName: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
} as const;

export type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

export type NotificationCalendarEventDetailRecord = Prisma.CalendarEventGetPayload<{
  select: typeof notificationDetailCalendarEventSelect;
}>;

export interface NotificationDetailRecord extends NotificationRecord {
  calendarEvent: NotificationCalendarEventDetailRecord | null;
}

const notificationPreferenceSelect = {
  inAppEnabled: true,
  emailEnabled: true,
  telegramEnabled: true,
  taskAssignedEnabled: true,
  serviceAssignedEnabled: true,
  remindersEnabled: true,
  birthdayDigestEnabled: true,
} as const;

export type NotificationPreferenceRecord = Prisma.NotificationPreferenceGetPayload<{
  select: typeof notificationPreferenceSelect;
}>;

export type TelegramNotificationBindingRecord = {
  enabled: boolean;
  username: string | null;
  blockedAt: Date | null;
  revokedAt: Date | null;
};

export interface TaskAssignedNotificationInput {
  organizationId: string;
  actorUserId: string;
  eventId: string;
  title: string;
  body: string;
  url: string;
  assigneeMembershipIds: string[];
}

export interface ServiceAssignedNotificationInput {
  organizationId: string;
  actorUserId: string;
  eventId: string;
  title: string;
  body: string;
  url: string;
  participantMembershipIds: string[];
}

export interface TaskAssignedNotificationResult {
  createdCount: number;
  telegramRecipientUserIds: string[];
  notificationByRecipientUserId: Map<string, string>;
}

export type ServiceAssignedNotificationResult = TaskAssignedNotificationResult;

export interface BirthdayDigestNotificationResult {
  createdCount: number;
  telegramRecipientUserIds: string[];
  notificationByRecipientUserId: Map<string, string>;
}

export interface BirthdayDigestGroup {
  organizationId: string;
  organizationName: string;
  birthdays: string[];
  recipientUserIds: string[];
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveMembership(organizationId: string, userId: string) {
    return this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        status: 'ACTIVE',
        removedAt: null,
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true },
    });
  }

  getPreferences(organizationId: string, userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      create: { organizationId, userId },
      update: {},
      select: notificationPreferenceSelect,
    });
  }

  updatePreferences(
    organizationId: string,
    userId: string,
    input: UpdateNotificationPreferencesInput,
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      create: { organizationId, userId, ...input },
      update: input,
      select: notificationPreferenceSelect,
    });
  }

  getTelegramBinding(userId: string): Promise<TelegramNotificationBindingRecord | null> {
    return this.prisma.telegramNotificationBinding.findUnique({
      where: { userId },
      select: {
        enabled: true,
        username: true,
        blockedAt: true,
        revokedAt: true,
      },
    });
  }

  async createTaskAssignedNotifications(
    input: TaskAssignedNotificationInput,
  ): Promise<TaskAssignedNotificationResult> {
    return this.createAssignmentNotifications({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventId: input.eventId,
      membershipIds: input.assigneeMembershipIds,
      type: 'TASK_ASSIGNED',
      preferenceKey: 'taskAssignedEnabled',
      title: input.title,
      body: input.body,
      url: input.url,
    });
  }

  async createServiceAssignedNotifications(
    input: ServiceAssignedNotificationInput,
  ): Promise<ServiceAssignedNotificationResult> {
    return this.createAssignmentNotifications({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventId: input.eventId,
      membershipIds: input.participantMembershipIds,
      type: 'SERVICE_ASSIGNED',
      preferenceKey: 'serviceAssignedEnabled',
      title: input.title,
      body: input.body,
      url: input.url,
    });
  }

  async listBirthdayDigestGroups(now: Date): Promise<BirthdayDigestGroup[]> {
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();
    const birthdays = await this.prisma.$queryRaw<
      Array<{
        organization_id: string;
        organization_name: string;
        display_name: string;
      }>
    >`
      SELECT
        "organizations"."id"::text AS "organization_id",
        "organizations"."name" AS "organization_name",
        "organization_member_profiles"."display_name" AS "display_name"
      FROM "organization_member_profiles"
      JOIN "organization_members"
        ON "organization_members"."id" = "organization_member_profiles"."membership_id"
      JOIN "organizations"
        ON "organizations"."id" = "organization_members"."organization_id"
      WHERE "organization_member_profiles"."birthday" IS NOT NULL
        AND EXTRACT(MONTH FROM "organization_member_profiles"."birthday") = ${month}
        AND EXTRACT(DAY FROM "organization_member_profiles"."birthday") = ${day}
        AND "organization_members"."status" = 'ACTIVE'::"OrganizationMemberStatus"
        AND "organization_members"."removed_at" IS NULL
        AND "organizations"."status" = 'ACTIVE'::"OrganizationStatus"
        AND "organizations"."deleted_at" IS NULL
      ORDER BY "organizations"."name" ASC, "organization_member_profiles"."display_name" ASC
    `;
    if (birthdays.length === 0) return [];

    const birthdayGroups = new Map<
      string,
      { organizationName: string; birthdays: string[]; recipientUserIds: string[] }
    >();
    for (const birthday of birthdays) {
      const group = birthdayGroups.get(birthday.organization_id) ?? {
        organizationName: birthday.organization_name,
        birthdays: [],
        recipientUserIds: [],
      };
      group.birthdays.push(birthday.display_name);
      birthdayGroups.set(birthday.organization_id, group);
    }

    const recipientMemberships = await this.prisma.organizationMember.findMany({
      where: {
        organizationId: { in: [...birthdayGroups.keys()] },
        role: { in: ['OWNER', 'ADMIN'] },
        status: 'ACTIVE',
        removedAt: null,
        userId: { not: null },
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: {
        organizationId: true,
        userId: true,
        user: {
          select: {
            deletedAt: true,
            notificationPreferences: {
              select: {
                inAppEnabled: true,
                telegramEnabled: true,
                birthdayDigestEnabled: true,
              },
            },
          },
        },
      },
    });

    for (const recipient of recipientMemberships) {
      if (!recipient.userId || recipient.user?.deletedAt) continue;
      const group = birthdayGroups.get(recipient.organizationId);
      if (group) group.recipientUserIds.push(recipient.userId);
    }

    return [...birthdayGroups.entries()].flatMap(([organizationId, group]) =>
      group.recipientUserIds.length > 0
        ? [
            {
              organizationId,
              organizationName: group.organizationName,
              birthdays: group.birthdays,
              recipientUserIds: [...new Set(group.recipientUserIds)],
            },
          ]
        : [],
    );
  }

  async createBirthdayDigestNotifications(input: {
    organizationId: string;
    recipientUserIds: string[];
    title: string;
    body: string;
    url: string;
    dedupeKey: string;
  }): Promise<BirthdayDigestNotificationResult> {
    const recipientUserIds = [...new Set(input.recipientUserIds)];
    if (recipientUserIds.length === 0) return emptyNotificationCreationResult();

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: recipientUserIds },
        deletedAt: null,
        memberships: {
          some: {
            organizationId: input.organizationId,
            role: { in: ['OWNER', 'ADMIN'] },
            status: 'ACTIVE',
            removedAt: null,
          },
        },
      },
      select: {
        id: true,
        notificationPreferences: {
          where: { organizationId: input.organizationId },
          select: {
            inAppEnabled: true,
            telegramEnabled: true,
            birthdayDigestEnabled: true,
          },
          take: 1,
        },
        memberships: {
          where: {
            organizationId: input.organizationId,
            role: { in: ['OWNER', 'ADMIN'] },
            status: 'ACTIVE',
            removedAt: null,
          },
          select: { id: true },
          take: 1,
        },
      },
    });
    const eligibleUsers = users.filter((user) => {
      const preferences = user.notificationPreferences[0];
      return preferences ? preferences.birthdayDigestEnabled : true;
    });
    const telegramRecipientUserIds = eligibleUsers
      .filter((user) => {
        const preferences = user.notificationPreferences[0];
        return Boolean(preferences?.telegramEnabled && preferences.birthdayDigestEnabled);
      })
      .map((user) => user.id);
    const inAppUsers = eligibleUsers.filter((user) => {
      const preferences = user.notificationPreferences[0];
      return preferences ? preferences.inAppEnabled && preferences.birthdayDigestEnabled : true;
    });
    if (inAppUsers.length === 0) {
      return {
        createdCount: 0,
        telegramRecipientUserIds,
        notificationByRecipientUserId: new Map(),
      };
    }

    const data: Prisma.NotificationCreateManyInput[] = inAppUsers.map((user) => ({
      organizationId: input.organizationId,
      recipientUserId: user.id,
      recipientMembershipId: user.memberships[0]?.id ?? null,
      type: 'BIRTHDAY_DIGEST',
      title: input.title,
      body: input.body,
      url: input.url,
      entityType: 'BirthdayDigest',
      dedupeKey: input.dedupeKey,
    }));
    const result = await this.prisma.notification.createMany({
      data,
      skipDuplicates: true,
    });
    const notifications = await this.prisma.notification.findMany({
      where: {
        organizationId: input.organizationId,
        recipientUserId: { in: data.map((notification) => notification.recipientUserId) },
        type: 'BIRTHDAY_DIGEST',
        dedupeKey: input.dedupeKey,
        deletedAt: null,
      },
      select: { id: true, recipientUserId: true },
    });

    return {
      createdCount: result.count,
      telegramRecipientUserIds,
      notificationByRecipientUserId: new Map(
        notifications.map((notification) => [notification.recipientUserId, notification.id]),
      ),
    };
  }

  private async createAssignmentNotifications(input: {
    organizationId: string;
    actorUserId: string;
    eventId: string;
    membershipIds: string[];
    type: 'TASK_ASSIGNED' | 'SERVICE_ASSIGNED';
    preferenceKey: 'taskAssignedEnabled' | 'serviceAssignedEnabled';
    title: string;
    body: string;
    url: string;
  }): Promise<TaskAssignedNotificationResult> {
    const membershipIds = [...new Set(input.membershipIds)];
    if (membershipIds.length === 0) return emptyTaskAssignedNotificationResult();

    const assignees = await this.prisma.organizationMember.findMany({
      where: {
        organizationId: input.organizationId,
        id: { in: membershipIds },
        status: 'ACTIVE',
        removedAt: null,
        userId: { not: null },
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            notificationPreferences: {
              where: { organizationId: input.organizationId },
              select: {
                inAppEnabled: true,
                telegramEnabled: true,
                taskAssignedEnabled: true,
                serviceAssignedEnabled: true,
              },
              take: 1,
            },
          },
        },
      },
    });
    const eligibleAssignees = assignees.filter((assignee) => {
      if (!assignee.userId || assignee.userId === input.actorUserId) return false;
      const preferences = assignee.user?.notificationPreferences[0];

      return preferences ? preferences[input.preferenceKey] : true;
    });
    if (eligibleAssignees.length === 0) return emptyTaskAssignedNotificationResult();
    const telegramRecipientUserIds = eligibleAssignees
      .filter((assignee) => {
        const preferences = assignee.user?.notificationPreferences[0];
        return Boolean(preferences?.telegramEnabled && preferences[input.preferenceKey]);
      })
      .map((assignee) => assignee.userId)
      .filter((userId): userId is string => Boolean(userId));
    const inAppAssignees = eligibleAssignees.filter((assignee) => {
      const preferences = assignee.user?.notificationPreferences[0];
      return preferences ? preferences.inAppEnabled && preferences[input.preferenceKey] : true;
    });
    if (inAppAssignees.length === 0) {
      return {
        createdCount: 0,
        telegramRecipientUserIds,
        notificationByRecipientUserId: new Map(),
      };
    }

    const existingNotifications = await this.prisma.notification.findMany({
      where: {
        organizationId: input.organizationId,
        recipientUserId: {
          in: inAppAssignees
            .map((assignee) => assignee.userId)
            .filter((userId): userId is string => Boolean(userId)),
        },
        type: input.type,
        entityType: 'CalendarEvent',
        entityId: input.eventId,
        deletedAt: null,
      },
      select: { recipientUserId: true },
    });
    const existingRecipientIds = new Set(
      existingNotifications.map((notification) => notification.recipientUserId),
    );
    const data: Prisma.NotificationCreateManyInput[] = inAppAssignees.flatMap((assignee) => {
      const userId = assignee.userId;
      if (!userId || existingRecipientIds.has(userId)) return [];

      return {
        organizationId: input.organizationId,
        recipientUserId: userId,
        recipientMembershipId: assignee.id,
        type: input.type,
        title: input.title,
        body: input.body,
        url: input.url,
        entityType: 'CalendarEvent',
        entityId: input.eventId,
      };
    });
    if (data.length === 0) {
      return {
        createdCount: 0,
        telegramRecipientUserIds,
        notificationByRecipientUserId: new Map(),
      };
    }

    const result = await this.prisma.notification.createMany({ data });
    const createdNotifications = await this.prisma.notification.findMany({
      where: {
        organizationId: input.organizationId,
        recipientUserId: {
          in: data.map((notification) => notification.recipientUserId),
        },
        type: input.type,
        entityType: 'CalendarEvent',
        entityId: input.eventId,
        deletedAt: null,
      },
      select: { id: true, recipientUserId: true },
    });

    return {
      createdCount: result.count,
      telegramRecipientUserIds,
      notificationByRecipientUserId: new Map(
        createdNotifications.map((notification) => [notification.recipientUserId, notification.id]),
      ),
    };
  }

  async listForUser(organizationId: string, userId: string, query: ListNotificationsQuery) {
    const where = this.visibleWhere(organizationId, userId);
    const cursorRecord = query.cursor
      ? await this.prisma.notification.findFirst({
          where: { ...where, id: query.cursor },
          select: { id: true, createdAt: true },
        })
      : null;
    const unreadCount = await this.countUnread(organizationId, userId);
    if (query.cursor && !cursorRecord) {
      return { items: [], nextCursor: null, unreadCount };
    }

    const items = await this.prisma.notification.findMany({
      where: {
        ...where,
        ...(cursorRecord ? { OR: afterCursorWhere(cursorRecord) } : {}),
      },
      select: notificationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const hasMore = items.length > query.limit;
    const pageItems = hasMore ? items.slice(0, query.limit) : items;
    const nextCursor = hasMore ? (pageItems.at(-1)?.id ?? null) : null;

    return {
      items: pageItems,
      nextCursor,
      unreadCount,
    };
  }

  async summaryForUser(organizationId: string, userId: string) {
    const [recentItems, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: this.visibleWhere(organizationId, userId),
        select: notificationSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10,
      }),
      this.countUnread(organizationId, userId),
    ]);

    return { recentItems, unreadCount };
  }

  async getForUser(
    organizationId: string,
    userId: string,
    notificationId: string,
  ): Promise<NotificationDetailRecord | null> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        ...this.visibleWhere(organizationId, userId),
        id: notificationId,
      },
      select: notificationSelect,
    });
    if (!notification) return null;

    const calendarEvent =
      notification.entityType === 'CalendarEvent' && notification.entityId
        ? await this.prisma.calendarEvent.findFirst({
            where: {
              id: notification.entityId,
              organizationId,
              deletedAt: null,
              organization: { status: 'ACTIVE', deletedAt: null },
            },
            select: notificationDetailCalendarEventSelect,
          })
        : null;

    return { ...notification, calendarEvent };
  }

  async markRead(organizationId: string, userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        ...this.visibleWhere(organizationId, userId),
        id: notificationId,
      },
      select: { id: true },
    });
    if (!notification) return null;

    return this.prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
      select: notificationSelect,
    });
  }

  async markAllRead(organizationId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        ...this.visibleWhere(organizationId, userId),
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { updatedCount: result.count };
  }

  private countUnread(organizationId: string, userId: string) {
    return this.prisma.notification.count({
      where: {
        ...this.visibleWhere(organizationId, userId),
        readAt: null,
      },
    });
  }

  private visibleWhere(organizationId: string, userId: string): Prisma.NotificationWhereInput {
    return {
      organizationId,
      recipientUserId: userId,
      archivedAt: null,
      deletedAt: null,
      organization: { status: 'ACTIVE', deletedAt: null },
    };
  }
}

function emptyTaskAssignedNotificationResult(): TaskAssignedNotificationResult {
  return emptyNotificationCreationResult();
}

function emptyNotificationCreationResult(): TaskAssignedNotificationResult {
  return {
    createdCount: 0,
    telegramRecipientUserIds: [],
    notificationByRecipientUserId: new Map(),
  };
}

function afterCursorWhere(cursor: {
  id: string;
  createdAt: Date;
}): Prisma.NotificationWhereInput[] {
  return [
    { createdAt: { lt: cursor.createdAt } },
    {
      createdAt: cursor.createdAt,
      id: { lt: cursor.id },
    },
  ];
}
