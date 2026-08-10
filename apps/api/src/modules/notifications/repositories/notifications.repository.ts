import { Injectable } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import type { NotificationType } from '@churchflow/db';
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
  | 'taskAssignedEnabled'
  | 'serviceAssignedEnabled'
  | 'remindersEnabled'
  | 'birthdayDigestEnabled'
  | 'organizationUpdatesEnabled';

export interface NotificationDeliveryRecipient {
  userId: string;
  email: string | null;
  emailEnabled: boolean;
  telegramEnabled: boolean;
  notificationId: string | null;
}

export interface NotificationCreationResult {
  createdCount: number;
  deliveryRecipients: NotificationDeliveryRecipient[];
  notificationByRecipientUserId: Map<string, string>;
}

export interface CreateNotificationsForMembershipsInput {
  organizationId: string;
  actorUserId?: string | null;
  recipientMembershipIds: string[];
  type: NotificationType;
  preferenceKey: NotificationPreferenceKey;
  title: string;
  body: string | null;
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
  title: string;
  body: string | null;
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
  deliveryRecipients: NotificationDeliveryRecipient[];
  notificationByRecipientUserId: Map<string, string>;
}

export type ServiceAssignedNotificationResult = TaskAssignedNotificationResult;

export interface BirthdayDigestNotificationResult {
  createdCount: number;
  deliveryRecipients: NotificationDeliveryRecipient[];
  notificationByRecipientUserId: Map<string, string>;
}

export interface BirthdayDigestGroup {
  organizationId: string;
  organizationName: string;
  birthdays: string[];
  anniversaries: string[];
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
      preferenceKey: 'taskAssignedEnabled',
      title: input.title,
      body: input.body,
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
      preferenceKey: 'serviceAssignedEnabled',
      title: input.title,
      body: input.body,
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
        preferences,
      };
    });

    return this.createNotificationsForEligibleRecipients({
      ...input,
      recipients: eligibleRecipients,
    });
  }

  async listBirthdayDigestGroups(now: Date): Promise<BirthdayDigestGroup[]> {
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();
    const milestones = await this.prisma.$queryRaw<
      Array<{
        organization_id: string;
        organization_name: string;
        display_name: string;
        milestone_type: 'birthday' | 'anniversary';
      }>
    >`
      SELECT
        "organizations"."id"::text AS "organization_id",
        "organizations"."name" AS "organization_name",
        "organization_member_profiles"."display_name" AS "display_name",
        'birthday' AS "milestone_type"
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

      UNION ALL

      SELECT
        "organizations"."id"::text AS "organization_id",
        "organizations"."name" AS "organization_name",
        "organization_member_profiles"."display_name" AS "display_name",
        'anniversary' AS "milestone_type"
      FROM "organization_member_profiles"
      JOIN "organization_members"
        ON "organization_members"."id" = "organization_member_profiles"."membership_id"
      JOIN "organizations"
        ON "organizations"."id" = "organization_members"."organization_id"
      WHERE "organization_member_profiles"."anniversary" IS NOT NULL
        AND EXTRACT(MONTH FROM "organization_member_profiles"."anniversary") = ${month}
        AND EXTRACT(DAY FROM "organization_member_profiles"."anniversary") = ${day}
        AND "organization_members"."status" = 'ACTIVE'::"OrganizationMemberStatus"
        AND "organization_members"."removed_at" IS NULL
        AND "organizations"."status" = 'ACTIVE'::"OrganizationStatus"
        AND "organizations"."deleted_at" IS NULL
      ORDER BY "organization_name" ASC, "display_name" ASC
    `;
    if (milestones.length === 0) return [];

    const birthdayGroups = new Map<
      string,
      {
        organizationName: string;
        birthdays: string[];
        anniversaries: string[];
        recipientUserIds: string[];
      }
    >();
    for (const milestone of milestones) {
      const group = birthdayGroups.get(milestone.organization_id) ?? {
        organizationName: milestone.organization_name,
        birthdays: [],
        anniversaries: [],
        recipientUserIds: [],
      };
      if (milestone.milestone_type === 'birthday') {
        group.birthdays.push(milestone.display_name);
      } else {
        group.anniversaries.push(milestone.display_name);
      }
      birthdayGroups.set(milestone.organization_id, group);
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
              anniversaries: group.anniversaries,
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
    return this.createNotificationsForUsers({
      organizationId: input.organizationId,
      recipientUserIds,
      type: 'BIRTHDAY_DIGEST',
      preferenceKey: 'birthdayDigestEnabled',
      title: input.title,
      body: input.body,
      url: input.url,
      entityType: 'BirthdayDigest',
      dedupeKey: input.dedupeKey,
      adminOnly: true,
    });
  }

  private async createNotificationsForEligibleRecipients(input: {
    organizationId: string;
    type: NotificationType;
    preferenceKey: NotificationPreferenceKey;
    title: string;
    body: string | null;
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
        notificationId: null,
      }));
    const inAppRecipients = input.recipients.filter((recipient) =>
      inAppDeliveryEnabled(recipient.preferences, input.preferenceKey),
    );

    if (inAppRecipients.length === 0) {
      return {
        createdCount: 0,
        deliveryRecipients,
        notificationByRecipientUserId: new Map(),
      };
    }

    const existingNotifications = await this.prisma.notification.findMany({
      where: {
        organizationId: input.organizationId,
        recipientUserId: { in: inAppRecipients.map((recipient) => recipient.userId) },
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
    const data: Prisma.NotificationCreateManyInput[] = inAppRecipients.flatMap((recipient) => {
      if (existingRecipientIds.has(recipient.userId)) return [];

      return {
        organizationId: input.organizationId,
        recipientUserId: recipient.userId,
        recipientMembershipId: recipient.membershipId,
        type: input.type,
        title: input.title,
        body: input.body,
        url: input.url,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        dedupeKey: input.dedupeKey ?? null,
      };
    });
    if (data.length === 0) {
      const notificationByRecipientUserId = new Map(
        existingNotifications.map((notification) => [
          notification.recipientUserId,
          notification.id,
        ]),
      );
      return {
        createdCount: 0,
        deliveryRecipients: withNotificationIds(
          newDeliveryRecipients,
          notificationByRecipientUserId,
        ),
        notificationByRecipientUserId,
      };
    }

    const result = await this.prisma.notification.createMany({ data, skipDuplicates: true });
    const createdNotifications = await this.prisma.notification.findMany({
      where: {
        organizationId: input.organizationId,
        recipientUserId: { in: inAppRecipients.map((recipient) => recipient.userId) },
        type: input.type,
        ...notificationDedupeWhere(input),
        deletedAt: null,
      },
      select: { id: true, recipientUserId: true },
    });

    return {
      createdCount: result.count,
      notificationByRecipientUserId: new Map(
        createdNotifications.map((notification) => [notification.recipientUserId, notification.id]),
      ),
      deliveryRecipients: withNotificationIds(
        newDeliveryRecipients,
        new Map(
          createdNotifications.map((notification) => [
            notification.recipientUserId,
            notification.id,
          ]),
        ),
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

function emptyNotificationCreationResult(): TaskAssignedNotificationResult {
  return {
    createdCount: 0,
    deliveryRecipients: [],
    notificationByRecipientUserId: new Map(),
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
