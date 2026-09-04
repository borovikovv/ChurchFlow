import { Injectable } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import type { NotificationType } from '@churchflow/db';
import type {
  ListNotificationsQuery,
  UpdateNotificationPreferencesInput,
} from '@churchflow/shared';
import { appLocaleOrFallback, DEFAULT_APP_LOCALE, type AppLocale } from '@churchflow/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  renderNotificationBody,
  renderNotificationTitle,
  type NotificationBodyMessage,
  type NotificationTitleKey,
} from '../notification-messages';

const notificationSelect = {
  id: true,
  organizationId: true,
  type: true,
  title: true,
  titleKey: true,
  body: true,
  bodyMessage: true,
  url: true,
  entityType: true,
  entityId: true,
  readAt: true,
  createdAt: true,
} as const;

const dismissedNotificationWhere: Prisma.NotificationWhereInput[] = [
  { readAt: { not: null } },
  { archivedAt: { not: null } },
  { deletedAt: { not: null } },
];

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
  assignmentsEnabled: true,
  remindersEnabled: true,
  birthdayDigestEnabled: true,
  prayerRequestsEnabled: true,
  organizationUpdatesEnabled: true,
  timeZone: true,
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

export type NotificationPreferenceKey =
  | 'assignmentsEnabled'
  | 'remindersEnabled'
  | 'birthdayDigestEnabled'
  | 'prayerRequestsEnabled'
  | 'organizationUpdatesEnabled';

export interface NotificationDeliveryRecipient {
  userId: string;
  email: string | null;
  emailEnabled: boolean;
  telegramEnabled: boolean;
  locale: AppLocale;
  notificationId: string | null;
}

export interface NotificationCreationResult {
  createdCount: number;
  deliveryRecipients: NotificationDeliveryRecipient[];
  notificationByRecipientUserId: Map<string, string>;
  notifiedMembershipIds: string[];
}

export interface CreateNotificationsForMembershipsInput {
  organizationId: string;
  actorUserId?: string | null;
  recipientMembershipIds: string[];
  type: NotificationType;
  preferenceKey: NotificationPreferenceKey;
  titleKey: NotificationTitleKey;
  bodyMessage: NotificationBodyMessage | null;
  url: string | null;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey?: string | null;
  adminOnly?: boolean;
}

export interface CreateNotificationsForUsersInput {
  organizationId: string;
  recipientUserIds: string[];
  type: NotificationType;
  preferenceKey: NotificationPreferenceKey;
  titleKey: NotificationTitleKey;
  bodyMessage: NotificationBodyMessage | null;
  url: string | null;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey?: string | null;
  adminOnly?: boolean;
}

export interface TaskAssignedNotificationInput {
  organizationId: string;
  actorUserId: string;
  eventId: string;
  titleKey: NotificationTitleKey;
  bodyMessage: NotificationBodyMessage;
  url: string;
  assigneeMembershipIds: string[];
}

export interface ServiceAssignedNotificationInput {
  organizationId: string;
  actorUserId: string;
  eventId: string;
  titleKey: NotificationTitleKey;
  bodyMessage: NotificationBodyMessage;
  url: string;
  participantMembershipIds: string[];
}

export type TaskAssignedNotificationResult = NotificationCreationResult;

export type ServiceAssignedNotificationResult = NotificationCreationResult;

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
      select: { id: true, user: { select: { locale: true } } },
    });
  }

  findOrganizationName(organizationId: string) {
    return this.prisma.organization.findFirst({
      where: { id: organizationId, status: 'ACTIVE', deletedAt: null },
      select: { name: true },
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
    const { timeZone, ...preferences } = input;
    const data = {
      ...preferences,
      ...(timeZone === undefined ? {} : { timeZone }),
    };

    return this.prisma.notificationPreference.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      create: { organizationId, userId, ...data },
      update: data,
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
    return this.createNotificationsForMemberships({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      recipientMembershipIds: input.assigneeMembershipIds,
      type: 'TASK_ASSIGNED',
      preferenceKey: 'assignmentsEnabled',
      titleKey: input.titleKey,
      bodyMessage: input.bodyMessage,
      url: input.url,
      entityType: 'CalendarEvent',
      entityId: input.eventId,
    });
  }

  async createServiceAssignedNotifications(
    input: ServiceAssignedNotificationInput,
  ): Promise<ServiceAssignedNotificationResult> {
    return this.createNotificationsForMemberships({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      recipientMembershipIds: input.participantMembershipIds,
      type: 'SERVICE_ASSIGNED',
      preferenceKey: 'assignmentsEnabled',
      titleKey: input.titleKey,
      bodyMessage: input.bodyMessage,
      url: input.url,
      entityType: 'CalendarEvent',
      entityId: input.eventId,
    });
  }

  async createNotificationsForMemberships(
    input: CreateNotificationsForMembershipsInput,
  ): Promise<NotificationCreationResult> {
    const membershipIds = [...new Set(input.recipientMembershipIds)];
    if (membershipIds.length === 0) return emptyNotificationCreationResult();

    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        organizationId: input.organizationId,
        id: { in: membershipIds },
        status: 'ACTIVE',
        removedAt: null,
        userId: { not: null },
        ...(input.adminOnly ? { role: { in: ['OWNER', 'ADMIN'] as const } } : {}),
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            email: true,
            locale: true,
            deletedAt: true,
            notificationPreferences: {
              where: { organizationId: input.organizationId },
              select: notificationPreferenceSelect,
              take: 1,
            },
          },
        },
      },
    });

    const eligibleRecipients = memberships.flatMap((membership) => {
      if (!membership.userId || membership.userId === input.actorUserId) return [];
      const user = membership.user;
      if (!user || user.deletedAt) return [];
      const preferences = user.notificationPreferences[0];
      if (preferences && !preferences[input.preferenceKey]) return [];

      return {
        membershipId: membership.id,
        userId: membership.userId,
        email: user.email,
        emailEnabled: Boolean(preferences?.emailEnabled),
        telegramEnabled: Boolean(preferences?.telegramEnabled),
        locale: appLocaleOrFallback(user.locale),
        preferences,
      };
    });

    return this.createNotificationsForEligibleRecipients({
      ...input,
      recipients: eligibleRecipients,
    });
  }

  async createNotificationsForUsers(
    input: CreateNotificationsForUsersInput,
  ): Promise<NotificationCreationResult> {
    const recipientUserIds = [...new Set(input.recipientUserIds)];
    if (recipientUserIds.length === 0) return emptyNotificationCreationResult();

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: recipientUserIds },
        deletedAt: null,
        memberships: {
          some: {
            organizationId: input.organizationId,
            status: 'ACTIVE',
            removedAt: null,
            ...(input.adminOnly ? { role: { in: ['OWNER', 'ADMIN'] as const } } : {}),
          },
        },
      },
      select: {
        id: true,
        email: true,
        locale: true,
        notificationPreferences: {
          where: { organizationId: input.organizationId },
          select: notificationPreferenceSelect,
          take: 1,
        },
        memberships: {
          where: {
            organizationId: input.organizationId,
            status: 'ACTIVE',
            removedAt: null,
            ...(input.adminOnly ? { role: { in: ['OWNER', 'ADMIN'] as const } } : {}),
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    const eligibleRecipients = users.flatMap((user) => {
      const preferences = user.notificationPreferences[0];
      if (preferences && !preferences[input.preferenceKey]) return [];

      return {
        membershipId: user.memberships[0]?.id ?? null,
        userId: user.id,
        email: user.email,
        emailEnabled: Boolean(preferences?.emailEnabled),
        telegramEnabled: Boolean(preferences?.telegramEnabled),
        locale: appLocaleOrFallback(user.locale),
        preferences,
      };
    });

    return this.createNotificationsForEligibleRecipients({
      ...input,
      recipients: eligibleRecipients,
    });
  }

  private async createNotificationsForEligibleRecipients(input: {
    organizationId: string;
    type: NotificationType;
    preferenceKey: NotificationPreferenceKey;
    titleKey: NotificationTitleKey;
    bodyMessage: NotificationBodyMessage | null;
    url: string | null;
    entityType?: string | null;
    entityId?: string | null;
    dedupeKey?: string | null;
    recipients: Array<{
      membershipId: string | null;
      userId: string;
      email: string | null;
      emailEnabled: boolean;
      telegramEnabled: boolean;
      locale: AppLocale;
      preferences: NotificationPreferenceRecord | undefined;
    }>;
  }): Promise<NotificationCreationResult> {
    if (input.recipients.length === 0) return emptyNotificationCreationResult();

    const deliveryRecipients = input.recipients
      .filter((recipient) => serviceDeliveryEnabled(recipient, input.preferenceKey))
      .map((recipient) => ({
        userId: recipient.userId,
        email: recipient.email,
        emailEnabled: recipient.emailEnabled,
        telegramEnabled: recipient.telegramEnabled,
        locale: recipient.locale,
        notificationId: null,
      }));
    const inAppRecipients = input.recipients.filter((recipient) =>
      inAppDeliveryEnabled(recipient.preferences, input.preferenceKey),
    );
    const inAppRecipientUserIds = new Set(inAppRecipients.map((recipient) => recipient.userId));
    const suppressedRecipients = input.recipients.filter(
      (recipient) =>
        !inAppRecipientUserIds.has(recipient.userId) &&
        serviceDeliveryEnabled(recipient, input.preferenceKey),
    );
    const trackedRecipients = [...inAppRecipients, ...suppressedRecipients];
    if (trackedRecipients.length === 0) return emptyNotificationCreationResult();

    const trackedRecipientUserIds = trackedRecipients.map((recipient) => recipient.userId);
    const existingNotifications = await this.prisma.notification.findMany({
      where: {
        organizationId: input.organizationId,
        recipientUserId: { in: trackedRecipientUserIds },
        type: input.type,
        ...notificationDedupeWhere(input),
        deletedAt: null,
      },
      select: { id: true, recipientUserId: true },
    });
    const existingRecipientIds = new Set(
      existingNotifications.map((notification) => notification.recipientUserId),
    );
    const newDeliveryRecipients = deliveryRecipients.filter(
      (recipient) => !existingRecipientIds.has(recipient.userId),
    );
    const notifiedMembershipIds = trackedRecipients.flatMap((recipient) =>
      !existingRecipientIds.has(recipient.userId) && recipient.membershipId
        ? [recipient.membershipId]
        : [],
    );
    const suppressedAt = new Date();
    const data: Prisma.NotificationCreateManyInput[] = trackedRecipients.flatMap((recipient) => {
      if (existingRecipientIds.has(recipient.userId)) return [];

      const suppressedFromInbox = !inAppRecipientUserIds.has(recipient.userId);

      return {
        organizationId: input.organizationId,
        recipientUserId: recipient.userId,
        recipientMembershipId: recipient.membershipId,
        type: input.type,
        title: renderNotificationTitle(input.titleKey, DEFAULT_APP_LOCALE),
        titleKey: input.titleKey,
        body: input.bodyMessage
          ? renderNotificationBody(input.bodyMessage, DEFAULT_APP_LOCALE)
          : null,
        bodyMessage: input.bodyMessage ?? Prisma.JsonNull,
        url: input.url,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        dedupeKey: input.dedupeKey ?? null,
        readAt: suppressedFromInbox ? suppressedAt : null,
        archivedAt: suppressedFromInbox ? suppressedAt : null,
      };
    });
    if (data.length === 0) {
      const notificationByRecipientUserId = new Map(
        existingNotifications
          .filter((notification) => inAppRecipientUserIds.has(notification.recipientUserId))
          .map((notification) => [notification.recipientUserId, notification.id]),
      );
      return {
        createdCount: 0,
        deliveryRecipients: withNotificationIds(
          newDeliveryRecipients,
          notificationByRecipientUserId,
        ),
        notificationByRecipientUserId,
        notifiedMembershipIds,
      };
    }

    const result = await this.prisma.notification.createMany({ data, skipDuplicates: true });
    const createdNotifications = await this.prisma.notification.findMany({
      where: {
        organizationId: input.organizationId,
        recipientUserId: { in: trackedRecipientUserIds },
        type: input.type,
        ...notificationDedupeWhere(input),
        deletedAt: null,
      },
      select: { id: true, recipientUserId: true },
    });
    const notificationByRecipientUserId = new Map(
      createdNotifications
        .filter((notification) => inAppRecipientUserIds.has(notification.recipientUserId))
        .map((notification) => [notification.recipientUserId, notification.id]),
    );

    return {
      createdCount: result.count,
      notificationByRecipientUserId,
      deliveryRecipients: withNotificationIds(newDeliveryRecipients, notificationByRecipientUserId),
      notifiedMembershipIds,
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

  countExpired(input: { cutoff: Date; onlyDismissed: boolean; excludeDismissedBefore?: Date }) {
    return this.prisma.notification.count({
      where: {
        createdAt: { lt: input.cutoff },
        ...(input.onlyDismissed ? { OR: dismissedNotificationWhere } : {}),
        ...(input.excludeDismissedBefore
          ? {
              NOT: {
                AND: [
                  { createdAt: { lt: input.excludeDismissedBefore } },
                  { OR: dismissedNotificationWhere },
                ],
              },
            }
          : {}),
      },
    });
  }

  async purgeExpired(input: {
    cutoff: Date;
    onlyDismissed: boolean;
    batchSize: number;
    maxBatches: number;
  }) {
    const dismissedFilter = input.onlyDismissed
      ? Prisma.sql`AND ("read_at" IS NOT NULL OR "archived_at" IS NOT NULL OR "deleted_at" IS NOT NULL)`
      : Prisma.empty;
    let deletedCount = 0;
    let batches = 0;

    while (batches < input.maxBatches) {
      const deleted = await this.prisma.$executeRaw`
        DELETE FROM "notifications"
        WHERE "id" IN (
          SELECT "id"
          FROM "notifications"
          WHERE "created_at" < ${input.cutoff.toISOString()}::timestamp
          ${dismissedFilter}
          LIMIT ${input.batchSize}
        )
      `;
      batches += 1;
      deletedCount += deleted;

      if (deleted < input.batchSize) {
        return { deletedCount, batches, exhausted: false };
      }
    }

    return { deletedCount, batches, exhausted: true };
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

function emptyNotificationCreationResult(): TaskAssignedNotificationResult {
  return {
    createdCount: 0,
    deliveryRecipients: [],
    notificationByRecipientUserId: new Map(),
    notifiedMembershipIds: [],
  };
}

function serviceDeliveryEnabled(
  recipient: {
    emailEnabled: boolean;
    telegramEnabled: boolean;
    preferences: NotificationPreferenceRecord | undefined;
  },
  preferenceKey: NotificationPreferenceKey,
): boolean {
  const preferences = recipient.preferences;
  return Boolean(
    preferences?.[preferenceKey] && (recipient.emailEnabled || recipient.telegramEnabled),
  );
}

function inAppDeliveryEnabled(
  preferences: NotificationPreferenceRecord | undefined,
  preferenceKey: NotificationPreferenceKey,
): boolean {
  return preferences ? preferences.inAppEnabled && preferences[preferenceKey] : true;
}

function withNotificationIds(
  recipients: NotificationDeliveryRecipient[],
  notificationByRecipientUserId: Map<string, string>,
): NotificationDeliveryRecipient[] {
  return recipients.map((recipient) => ({
    ...recipient,
    notificationId: notificationByRecipientUserId.get(recipient.userId) ?? null,
  }));
}

function notificationDedupeWhere(input: {
  dedupeKey?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}): Pick<Prisma.NotificationWhereInput, 'dedupeKey' | 'entityType' | 'entityId'> {
  if (input.dedupeKey) return { dedupeKey: input.dedupeKey };

  return {
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
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
