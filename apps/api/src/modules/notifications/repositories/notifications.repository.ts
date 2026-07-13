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

export type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

const notificationPreferenceSelect = {
  inAppEnabled: true,
  emailEnabled: true,
  telegramEnabled: true,
  taskAssignedEnabled: true,
  serviceAssignedEnabled: true,
  remindersEnabled: true,
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

  async createTaskAssignedNotifications(input: TaskAssignedNotificationInput) {
    const membershipIds = [...new Set(input.assigneeMembershipIds)];
    if (membershipIds.length === 0) return { createdCount: 0 };

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
                taskAssignedEnabled: true,
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

      return preferences ? preferences.inAppEnabled && preferences.taskAssignedEnabled : true;
    });
    if (eligibleAssignees.length === 0) return { createdCount: 0 };

    const existingNotifications = await this.prisma.notification.findMany({
      where: {
        organizationId: input.organizationId,
        recipientUserId: {
          in: eligibleAssignees
            .map((assignee) => assignee.userId)
            .filter((userId): userId is string => Boolean(userId)),
        },
        type: 'TASK_ASSIGNED',
        entityType: 'CalendarEvent',
        entityId: input.eventId,
        deletedAt: null,
      },
      select: { recipientUserId: true },
    });
    const existingRecipientIds = new Set(
      existingNotifications.map((notification) => notification.recipientUserId),
    );
    const data: Prisma.NotificationCreateManyInput[] = eligibleAssignees.flatMap((assignee) => {
      const userId = assignee.userId;
      if (!userId || existingRecipientIds.has(userId)) return [];

      return {
        organizationId: input.organizationId,
        recipientUserId: userId,
        recipientMembershipId: assignee.id,
        type: 'TASK_ASSIGNED',
        title: input.title,
        body: input.body,
        url: input.url,
        entityType: 'CalendarEvent',
        entityId: input.eventId,
      };
    });
    if (data.length === 0) return { createdCount: 0 };

    const result = await this.prisma.notification.createMany({ data });

    return { createdCount: result.count };
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
