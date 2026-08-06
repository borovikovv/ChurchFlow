import { Injectable } from '@nestjs/common';
import { Prisma } from '@churchflow/db';
import { PrismaService } from '../../../prisma/prisma.service';

const upcomingServiceInclude = {
  organization: { select: { id: true, name: true } },
  serviceDetails: {
    include: {
      participants: {
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
} as const;

export type UpcomingSundayServiceRecord = Prisma.CalendarEventGetPayload<{
  include: typeof upcomingServiceInclude;
}>;

export interface TelegramNotificationDelivery {
  notificationId: string | null;
  organizationName: string;
  recipientUserId: string;
  chatId: string;
  title: string;
  body: string | null;
  url: string | null;
}

@Injectable()
export class TelegramBotRepository {
  constructor(private readonly prisma: PrismaService) {}

  createLinkToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.prisma.telegramNotificationLinkToken.create({
      data: { userId, tokenHash, expiresAt },
      select: { expiresAt: true },
    });
  }

  async consumeLinkToken(input: {
    tokenHash: string;
    telegramUserId: string;
    telegramChatId: string;
    username: string | null;
  }) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const token = await tx.telegramNotificationLinkToken.findFirst({
        where: {
          tokenHash: input.tokenHash,
          consumedAt: null,
          expiresAt: { gt: now },
          user: { deletedAt: null },
        },
        select: { id: true, userId: true },
      });
      if (!token) return null;

      await tx.telegramNotificationLinkToken.update({
        where: { id: token.id },
        data: { consumedAt: now },
      });

      await tx.telegramNotificationBinding.deleteMany({
        where: {
          userId: token.userId,
          telegramUserId: { not: input.telegramUserId },
        },
      });

      return tx.telegramNotificationBinding.upsert({
        where: { telegramUserId: input.telegramUserId },
        create: {
          userId: token.userId,
          telegramUserId: input.telegramUserId,
          telegramChatId: input.telegramChatId,
          username: input.username,
          enabled: true,
          connectedAt: now,
          lastSeenAt: now,
          revokedAt: null,
          blockedAt: null,
        },
        update: {
          userId: token.userId,
          telegramUserId: input.telegramUserId,
          telegramChatId: input.telegramChatId,
          username: input.username,
          enabled: true,
          connectedAt: now,
          lastSeenAt: now,
          revokedAt: null,
          blockedAt: null,
        },
        select: {
          userId: true,
          username: true,
        },
      });
    });
  }

  findBindingByTelegramIdentity(telegramUserId: string, telegramChatId: string) {
    return this.prisma.telegramNotificationBinding.findFirst({
      where: {
        telegramUserId,
        telegramChatId,
        enabled: true,
        revokedAt: null,
        blockedAt: null,
        user: { deletedAt: null },
      },
      select: {
        userId: true,
        username: true,
        user: {
          select: {
            notificationPreferences: {
              select: {
                telegramEnabled: true,
                taskAssignedEnabled: true,
                serviceAssignedEnabled: true,
                remindersEnabled: true,
                birthdayDigestEnabled: true,
                organization: { select: { name: true } },
              },
              orderBy: { updatedAt: 'desc' },
            },
          },
        },
      },
    });
  }

  async disableBindingByTelegramIdentity(telegramUserId: string, telegramChatId: string) {
    const binding = await this.prisma.telegramNotificationBinding.findFirst({
      where: { telegramUserId, telegramChatId },
      select: { id: true },
    });
    if (!binding) return null;

    return this.prisma.telegramNotificationBinding.update({
      where: { id: binding.id },
      data: { enabled: false, revokedAt: new Date() },
      select: { userId: true },
    });
  }

  async disconnectUserBinding(userId: string) {
    const binding = await this.prisma.telegramNotificationBinding.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!binding) return null;

    return this.prisma.telegramNotificationBinding.update({
      where: { id: binding.id },
      data: { enabled: false, revokedAt: new Date() },
      select: {
        enabled: true,
        username: true,
        blockedAt: true,
        revokedAt: true,
      },
    });
  }

  markBindingBlockedByChatId(chatId: string) {
    return this.prisma.telegramNotificationBinding.updateMany({
      where: { telegramChatId: chatId },
      data: { enabled: false, blockedAt: new Date() },
    });
  }

  async getTaskAssignedTelegramDeliveries(input: {
    organizationId: string;
    recipientUserIds: string[];
    notificationByRecipientUserId: Map<string, string>;
    title: string;
    body: string | null;
    url: string | null;
  }): Promise<TelegramNotificationDelivery[]> {
    if (input.recipientUserIds.length === 0) return [];

    const organization = await this.prisma.organization.findFirst({
      where: { id: input.organizationId, status: 'ACTIVE', deletedAt: null },
      select: { name: true },
    });
    if (!organization) return [];

    const bindings = await this.prisma.telegramNotificationBinding.findMany({
      where: {
        userId: { in: input.recipientUserIds },
        enabled: true,
        revokedAt: null,
        blockedAt: null,
        user: {
          deletedAt: null,
          notificationPreferences: {
            some: {
              organizationId: input.organizationId,
              telegramEnabled: true,
              taskAssignedEnabled: true,
            },
          },
        },
      },
      select: {
        userId: true,
        telegramChatId: true,
      },
    });

    return bindings.map((binding) => ({
      notificationId: input.notificationByRecipientUserId.get(binding.userId) ?? null,
      organizationName: organization.name,
      recipientUserId: binding.userId,
      chatId: binding.telegramChatId,
      title: input.title,
      body: input.body,
      url: input.url,
    }));
  }

  async getServiceAssignedTelegramDeliveries(input: {
    organizationId: string;
    recipientUserIds: string[];
    notificationByRecipientUserId: Map<string, string>;
    title: string;
    body: string | null;
    url: string | null;
  }): Promise<TelegramNotificationDelivery[]> {
    if (input.recipientUserIds.length === 0) return [];

    const organization = await this.prisma.organization.findFirst({
      where: { id: input.organizationId, status: 'ACTIVE', deletedAt: null },
      select: { name: true },
    });
    if (!organization) return [];

    const bindings = await this.prisma.telegramNotificationBinding.findMany({
      where: {
        userId: { in: input.recipientUserIds },
        enabled: true,
        revokedAt: null,
        blockedAt: null,
        user: {
          deletedAt: null,
          notificationPreferences: {
            some: {
              organizationId: input.organizationId,
              telegramEnabled: true,
              serviceAssignedEnabled: true,
            },
          },
        },
      },
      select: {
        userId: true,
        telegramChatId: true,
      },
    });

    return bindings.map((binding) => ({
      notificationId: input.notificationByRecipientUserId.get(binding.userId) ?? null,
      organizationName: organization.name,
      recipientUserId: binding.userId,
      chatId: binding.telegramChatId,
      title: input.title,
      body: input.body,
      url: input.url,
    }));
  }

  async getBirthdayDigestTelegramDeliveries(input: {
    organizationId: string;
    recipientUserIds: string[];
    notificationByRecipientUserId: Map<string, string>;
    title: string;
    body: string | null;
    url: string | null;
  }): Promise<TelegramNotificationDelivery[]> {
    if (input.recipientUserIds.length === 0) return [];

    const organization = await this.prisma.organization.findFirst({
      where: { id: input.organizationId, status: 'ACTIVE', deletedAt: null },
      select: { name: true },
    });
    if (!organization) return [];

    const bindings = await this.prisma.telegramNotificationBinding.findMany({
      where: {
        userId: { in: input.recipientUserIds },
        enabled: true,
        revokedAt: null,
        blockedAt: null,
        user: {
          deletedAt: null,
          notificationPreferences: {
            some: {
              organizationId: input.organizationId,
              telegramEnabled: true,
              birthdayDigestEnabled: true,
            },
          },
        },
      },
      select: {
        userId: true,
        telegramChatId: true,
      },
    });

    return bindings.map((binding) => ({
      notificationId: input.notificationByRecipientUserId.get(binding.userId) ?? null,
      organizationName: organization.name,
      recipientUserId: binding.userId,
      chatId: binding.telegramChatId,
      title: input.title,
      body: input.body,
      url: input.url,
    }));
  }

  async listUpcomingSundayServicesForUser(
    userId: string,
    now: Date,
  ): Promise<UpcomingSundayServiceRecord[]> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        removedAt: null,
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: { organizationId: true },
      orderBy: { joinedAt: 'desc' },
    });
    if (!membership) return [];

    const ids = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "calendar_events"."id"
      FROM "calendar_events"
      JOIN "organizations" ON "organizations"."id" = "calendar_events"."organization_id"
      WHERE "calendar_events"."organization_id" = ${membership.organizationId}::uuid
        AND "calendar_events"."type" = 'SERVICE'::"CalendarEventType"
        AND "calendar_events"."starts_at" >= ${now}
        AND "calendar_events"."deleted_at" IS NULL
        AND "organizations"."status" = 'ACTIVE'::"OrganizationStatus"
        AND "organizations"."deleted_at" IS NULL
        AND EXTRACT(DOW FROM "calendar_events"."starts_at") = 0
      ORDER BY "calendar_events"."starts_at" ASC, "calendar_events"."id" ASC
      LIMIT 4
    `;
    const eventIds = ids.map((row) => row.id);
    if (eventIds.length === 0) return [];

    const events = await this.prisma.calendarEvent.findMany({
      where: { id: { in: eventIds } },
      include: upcomingServiceInclude,
    });
    const eventById = new Map(events.map((event) => [event.id, event]));

    return eventIds.flatMap((id) => {
      const event = eventById.get(id);
      return event ? [event] : [];
    });
  }
}
