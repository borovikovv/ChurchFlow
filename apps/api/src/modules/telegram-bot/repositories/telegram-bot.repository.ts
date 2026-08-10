import { Injectable } from '@nestjs/common';
import { Prisma, type OrganizationRole } from '@churchflow/db';
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

export type UpcomingServiceRecord = Prisma.CalendarEventGetPayload<{
  include: typeof upcomingServiceInclude;
}>;

export interface ActiveTelegramOrganizationRecord {
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
}

export interface TelegramNotificationDelivery {
  notificationId: string | null;
  organizationName: string;
  recipientUserId: string;
  chatId: string;
  title: string;
  body: string | null;
  url: string | null;
}

export type TelegramNotificationPreferenceKey =
  | 'taskAssignedEnabled'
  | 'serviceAssignedEnabled'
  | 'remindersEnabled'
  | 'birthdayDigestEnabled'
  | 'organizationUpdatesEnabled';

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
                organizationUpdatesEnabled: true,
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
    return this.getNotificationTelegramDeliveries({
      ...input,
      preferenceKey: 'taskAssignedEnabled',
    });
  }

  async getServiceAssignedTelegramDeliveries(input: {
    organizationId: string;
    recipientUserIds: string[];
    notificationByRecipientUserId: Map<string, string>;
    title: string;
    body: string | null;
    url: string | null;
  }): Promise<TelegramNotificationDelivery[]> {
    return this.getNotificationTelegramDeliveries({
      ...input,
      preferenceKey: 'serviceAssignedEnabled',
    });
  }

  async getBirthdayDigestTelegramDeliveries(input: {
    organizationId: string;
    recipientUserIds: string[];
    notificationByRecipientUserId: Map<string, string>;
    title: string;
    body: string | null;
    url: string | null;
  }): Promise<TelegramNotificationDelivery[]> {
    return this.getNotificationTelegramDeliveries({
      ...input,
      preferenceKey: 'birthdayDigestEnabled',
    });
  }

  async getNotificationTelegramDeliveries(input: {
    organizationId: string;
    recipientUserIds: string[];
    notificationByRecipientUserId: Map<string, string>;
    title: string;
    body: string | null;
    url: string | null;
    preferenceKey: TelegramNotificationPreferenceKey;
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
              [input.preferenceKey]: true,
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

  async getPlatformAdminTelegramDeliveries(input: {
    title: string;
    body: string | null;
    url: string | null;
  }): Promise<TelegramNotificationDelivery[]> {
    const bindings = await this.prisma.telegramNotificationBinding.findMany({
      where: {
        enabled: true,
        revokedAt: null,
        blockedAt: null,
        user: {
          deletedAt: null,
          platformRole: { in: ['ADMIN', 'SUPER_ADMIN'] },
        },
      },
      select: {
        userId: true,
        telegramChatId: true,
      },
    });

    return bindings.map((binding) => ({
      notificationId: null,
      organizationName: 'ChurchFlow',
      recipientUserId: binding.userId,
      chatId: binding.telegramChatId,
      title: input.title,
      body: input.body,
      url: input.url,
    }));
  }

  async listActiveOrganizationsForUser(
    userId: string,
  ): Promise<ActiveTelegramOrganizationRecord[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        removedAt: null,
        role: { in: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] },
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: {
        organizationId: true,
        role: true,
        organization: { select: { name: true } },
      },
      orderBy: [{ organization: { name: 'asc' } }, { organizationId: 'asc' }],
    });

    return memberships.map((membership) => ({
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      role: membership.role,
    }));
  }

  async listUpcomingServicesForOrganization(input: {
    userId: string;
    organizationId: string;
    rangeStart: Date;
    rangeEnd: Date;
  }): Promise<UpcomingServiceRecord[]> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId: input.userId,
        organizationId: input.organizationId,
        status: 'ACTIVE',
        removedAt: null,
        role: { in: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] },
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true },
    });
    if (!membership) return [];

    return this.prisma.calendarEvent.findMany({
      where: {
        organizationId: input.organizationId,
        type: 'SERVICE',
        startsAt: {
          gte: input.rangeStart,
          lt: input.rangeEnd,
        },
        deletedAt: null,
        organization: {
          status: 'ACTIVE',
          deletedAt: null,
          members: {
            some: {
              userId: input.userId,
              status: 'ACTIVE',
              removedAt: null,
              role: { in: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] },
            },
          },
        },
      },
      include: upcomingServiceInclude,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });
  }
}
