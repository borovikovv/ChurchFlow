import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  ListNotificationsQuery,
  NotificationDetail,
  NotificationPreferences,
  NotificationListItem,
  NotificationsPage,
  NotificationsSummary,
  UpdateNotificationPreferencesInput,
} from '@churchflow/shared';
import {
  NotificationsRepository,
  type CreateNotificationsForMembershipsInput,
  type ServiceAssignedNotificationInput,
  type NotificationCreationResult,
  type NotificationCalendarEventDetailRecord,
  type NotificationDetailRecord,
  type NotificationPreferenceKey,
  type NotificationPreferenceRecord,
  type NotificationRecord,
  type TaskAssignedNotificationInput,
  type TelegramNotificationBindingRecord,
} from './repositories/notifications.repository';
import { EmailService } from '../email/email.service';
import { TelegramBotRepository } from '../telegram-bot/repositories/telegram-bot.repository';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';

type NotificationDeliveryServiceName = 'email' | 'telegram';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly telegramBotRepository: TelegramBotRepository,
    private readonly telegramBotService: TelegramBotService,
    private readonly emailService: EmailService,
  ) {}

  async listForOrganization(
    organizationId: string,
    actorUserId: string,
    query: ListNotificationsQuery,
  ): Promise<NotificationsPage> {
    const membership = await this.notificationsRepository.findActiveMembership(
      organizationId,
      actorUserId,
    );
    if (!membership) {
      return { items: [], nextCursor: null, unreadCount: 0 };
    }

    const page = await this.notificationsRepository.listForUser(organizationId, actorUserId, query);

    return {
      items: page.items.map(notificationToItem),
      nextCursor: page.nextCursor,
      unreadCount: page.unreadCount,
    };
  }

  async summaryForOrganization(
    organizationId: string,
    actorUserId: string,
  ): Promise<NotificationsSummary> {
    const membership = await this.notificationsRepository.findActiveMembership(
      organizationId,
      actorUserId,
    );
    if (!membership) {
      return { recentItems: [], unreadCount: 0 };
    }

    const summary = await this.notificationsRepository.summaryForUser(organizationId, actorUserId);

    return {
      recentItems: summary.recentItems.map(notificationToItem),
      unreadCount: summary.unreadCount,
    };
  }

  async detailForOrganization(
    organizationId: string,
    notificationId: string,
    actorUserId: string,
  ): Promise<NotificationDetail> {
    const membership = await this.notificationsRepository.findActiveMembership(
      organizationId,
      actorUserId,
    );
    if (!membership) {
      throw new NotFoundException('Notification was not found');
    }

    const notification = await this.notificationsRepository.getForUser(
      organizationId,
      actorUserId,
      notificationId,
    );
    if (!notification) {
      throw new NotFoundException('Notification was not found');
    }

    return notificationToDetail(notification);
  }

  async preferencesForOrganization(
    organizationId: string,
    actorUserId: string,
  ): Promise<NotificationPreferences> {
    const membership = await this.notificationsRepository.findActiveMembership(
      organizationId,
      actorUserId,
    );
    if (!membership) {
      throw new NotFoundException('Notification preferences were not found');
    }

    const [preferences, telegramBinding] = await Promise.all([
      this.notificationsRepository.getPreferences(organizationId, actorUserId),
      this.notificationsRepository.getTelegramBinding(actorUserId),
    ]);

    return preferencesToResponse(preferences, telegramBinding);
  }

  async updatePreferences(
    organizationId: string,
    actorUserId: string,
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences> {
    const membership = await this.notificationsRepository.findActiveMembership(
      organizationId,
      actorUserId,
    );
    if (!membership) {
      throw new NotFoundException('Notification preferences were not found');
    }

    const telegramBinding = await this.notificationsRepository.getTelegramBinding(actorUserId);
    if (input.telegramEnabled && !isActiveTelegramBinding(telegramBinding)) {
      throw new ConflictException('Connect Telegram before enabling Telegram notifications');
    }

    const preferences = await this.notificationsRepository.updatePreferences(
      organizationId,
      actorUserId,
      input,
    );

    return preferencesToResponse(preferences, telegramBinding);
  }

  async createTaskAssignedNotifications(input: TaskAssignedNotificationInput) {
    const result = await this.notificationsRepository.createTaskAssignedNotifications(input);
    const sentCounts = await this.dispatchToEnabledServices(input, result, 'taskAssignedEnabled');

    return { createdCount: result.createdCount, ...sentCounts };
  }

  async createServiceAssignedNotifications(input: ServiceAssignedNotificationInput) {
    const result = await this.notificationsRepository.createServiceAssignedNotifications(input);
    const sentCounts = await this.dispatchToEnabledServices(
      input,
      result,
      'serviceAssignedEnabled',
    );

    return { createdCount: result.createdCount, ...sentCounts };
  }

  async createCalendarLinkedNotifications(input: CreateNotificationsForMembershipsInput) {
    const result = await this.notificationsRepository.createNotificationsForMemberships(input);
    const sentCounts = await this.dispatchToEnabledServices(input, result, input.preferenceKey);

    return { createdCount: result.createdCount, ...sentCounts };
  }

  async createCalendarReminderNotifications(input: CreateNotificationsForMembershipsInput) {
    const result = await this.notificationsRepository.createNotificationsForMemberships(input);
    const sentCounts = await this.dispatchToEnabledServices(input, result, input.preferenceKey);

    return { createdCount: result.createdCount, ...sentCounts };
  }

  async createAdminMembershipChangeNotifications(input: CreateNotificationsForMembershipsInput) {
    const result = await this.notificationsRepository.createNotificationsForMemberships(input);
    const sentCounts = await this.dispatchToEnabledServices(input, result, input.preferenceKey);

    return { createdCount: result.createdCount, ...sentCounts };
  }

  async createPrayerRequestCreatedNotifications(input: CreateNotificationsForMembershipsInput) {
    const result = await this.notificationsRepository.createNotificationsForMemberships(input);
    const sentCounts = await this.dispatchToEnabledServices(input, result, input.preferenceKey);

    return { createdCount: result.createdCount, ...sentCounts };
  }

  async createBirthdayDigestNotifications(now = new Date()) {
    const digestDate = formatDateKey(now);
    const groups = await this.notificationsRepository.listBirthdayDigestGroups(now);
    let createdCount = 0;
    let emailSentCount = 0;
    let telegramSentCount = 0;

    for (const group of groups) {
      const title = birthdayDigestTitle(group);
      const body = birthdayDigestBody(group);
      const result = await this.notificationsRepository.createBirthdayDigestNotifications({
        organizationId: group.organizationId,
        recipientUserIds: group.recipientUserIds,
        title,
        body,
        url: `/dashboard/${group.organizationId}/calendar`,
        dedupeKey: `birthday-digest:${digestDate}`,
      });
      createdCount += result.createdCount;

      const sentCounts = await this.dispatchToEnabledServices(
        {
          organizationId: group.organizationId,
          title,
          body,
          url: `/dashboard/${group.organizationId}/calendar`,
        },
        result,
        'birthdayDigestEnabled',
      );
      emailSentCount += sentCounts.emailSentCount;
      telegramSentCount += sentCounts.telegramSentCount;
    }

    this.logger.log({
      event: 'Birthday digest notifications processed',
      digestDate,
      organizationsCount: groups.length,
      createdCount,
      emailSentCount,
      telegramSentCount,
    });

    return { organizationsCount: groups.length, createdCount, emailSentCount, telegramSentCount };
  }

  private async dispatchToEnabledServices(
    input: {
      organizationId: string;
      title: string;
      body: string | null;
      url: string | null;
    },
    result: NotificationCreationResult,
    preferenceKey: NotificationPreferenceKey,
  ): Promise<Record<`${NotificationDeliveryServiceName}SentCount`, number>> {
    const deliveryServices = [
      {
        name: 'email' as const,
        deliver: async () => {
          const organization = await this.notificationsRepository.findOrganizationName(
            input.organizationId,
          );
          if (!organization) return 0;

          const recipients = result.deliveryRecipients.filter(
            (recipient) => recipient.emailEnabled && recipient.email,
          );
          const deliveryResults = await Promise.all(
            recipients.map(async (recipient) => {
              try {
                await this.emailService.sendNotificationEmail({
                  email: recipient.email ?? '',
                  organizationName: organization.name,
                  title: input.title,
                  body: input.body,
                  url: input.url,
                  notificationId: recipient.notificationId,
                });
                return true;
              } catch (error: unknown) {
                this.logger.warn({
                  event: 'Notification email delivery skipped',
                  organizationId: input.organizationId,
                  recipientUserId: recipient.userId,
                  error: error instanceof Error ? error.message : String(error),
                });
                return false;
              }
            }),
          );

          return deliveryResults.filter(Boolean).length;
        },
      },
      {
        name: 'telegram' as const,
        deliver: async () => {
          const deliveries = await this.telegramBotRepository.getNotificationTelegramDeliveries({
            organizationId: input.organizationId,
            recipientUserIds: result.deliveryRecipients
              .filter((recipient) => recipient.telegramEnabled)
              .map((recipient) => recipient.userId),
            notificationByRecipientUserId: result.notificationByRecipientUserId,
            title: input.title,
            body: input.body,
            url: input.url,
            preferenceKey,
          });

          await Promise.all(
            deliveries.map((delivery) => this.telegramBotService.deliverNotification(delivery)),
          );

          return deliveries.length;
        },
      },
    ];

    const entries = await Promise.all(
      deliveryServices.map(async (service) => {
        try {
          return [`${service.name}SentCount`, await service.deliver()] as const;
        } catch (error: unknown) {
          this.logger.error({
            event: 'Notification delivery failed',
            service: service.name,
            organizationId: input.organizationId,
            error: error instanceof Error ? error.message : String(error),
          });
          return [`${service.name}SentCount`, 0] as const;
        }
      }),
    );

    return Object.fromEntries(entries) as Record<
      `${NotificationDeliveryServiceName}SentCount`,
      number
    >;
  }

  async markRead(organizationId: string, notificationId: string, actorUserId: string) {
    const membership = await this.notificationsRepository.findActiveMembership(
      organizationId,
      actorUserId,
    );
    if (!membership) {
      throw new NotFoundException('Notification was not found');
    }

    const notification = await this.notificationsRepository.markRead(
      organizationId,
      actorUserId,
      notificationId,
    );
    if (!notification) {
      throw new NotFoundException('Notification was not found');
    }

    return notificationToItem(notification);
  }

  async markAllRead(organizationId: string, actorUserId: string) {
    const membership = await this.notificationsRepository.findActiveMembership(
      organizationId,
      actorUserId,
    );
    if (!membership) {
      return { updatedCount: 0 };
    }

    return this.notificationsRepository.markAllRead(organizationId, actorUserId);
  }
}

function preferencesToResponse(
  preferences: NotificationPreferenceRecord,
  telegramBinding: TelegramNotificationBindingRecord | null,
): NotificationPreferences {
  return {
    inAppEnabled: preferences.inAppEnabled,
    emailEnabled: preferences.emailEnabled,
    telegramEnabled: preferences.telegramEnabled && isActiveTelegramBinding(telegramBinding),
    taskAssignedEnabled: preferences.taskAssignedEnabled,
    serviceAssignedEnabled: preferences.serviceAssignedEnabled,
    remindersEnabled: preferences.remindersEnabled,
    birthdayDigestEnabled: preferences.birthdayDigestEnabled,
    organizationUpdatesEnabled: preferences.organizationUpdatesEnabled,
    timeZone: preferences.timeZone,
    telegram: {
      connected: Boolean(telegramBinding),
      enabled: isActiveTelegramBinding(telegramBinding),
      username: telegramBinding?.username ?? null,
      blockedAt: telegramBinding?.blockedAt?.toISOString() ?? null,
      revokedAt: telegramBinding?.revokedAt?.toISOString() ?? null,
    },
  };
}

function isActiveTelegramBinding(binding: TelegramNotificationBindingRecord | null): boolean {
  return Boolean(binding && binding.enabled && !binding.blockedAt && !binding.revokedAt);
}

function notificationToItem(notification: NotificationRecord): NotificationListItem {
  return {
    id: notification.id,
    organizationId: notification.organizationId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    url: notification.url,
    entityType: notification.entityType,
    entityId: notification.entityId,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

function notificationToDetail(notification: NotificationDetailRecord): NotificationDetail {
  return {
    ...notificationToItem(notification),
    calendarEvent: notification.calendarEvent
      ? calendarEventToNotificationDetail(notification.calendarEvent)
      : null,
  };
}

function calendarEventToNotificationDetail(
  event: NotificationCalendarEventDetailRecord,
): NotificationDetail['calendarEvent'] {
  return {
    id: event.id,
    type: event.type,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    allDay: event.allDay,
    assignees: event.assignees.map((assignee) => ({
      id: assignee.membership.id,
      displayName: memberDisplayName(assignee.membership),
    })),
    participants: (event.serviceDetails?.participants ?? []).map((participant) => ({
      role: participant.role,
      displayName:
        participant.displayNameSnapshot ??
        (participant.membership ? memberDisplayName(participant.membership) : null) ??
        participant.customName ??
        'Guest',
    })),
  };
}

function memberDisplayName(member: {
  profile: { displayName: string } | null;
  user: { displayName: string | null; email: string | null } | null;
}): string {
  return member.profile?.displayName ?? member.user?.displayName ?? member.user?.email ?? 'Member';
}

function birthdayDigestTitle(group: { birthdays: string[]; anniversaries: string[] }): string {
  if (group.birthdays.length > 0 && group.anniversaries.length > 0) {
    return 'Birthdays and anniversaries today';
  }
  if (group.anniversaries.length > 0) return 'Anniversaries today';
  return 'Birthdays today';
}

function birthdayDigestBody(group: { birthdays: string[]; anniversaries: string[] }): string {
  const sections = [
    milestoneDigestSection('Birthdays', group.birthdays),
    milestoneDigestSection('Anniversaries', group.anniversaries),
  ].filter((section): section is string => Boolean(section));

  return sections.join('\n');
}

function milestoneDigestSection(label: string, names: string[]): string | null {
  if (names.length === 0) return null;
  return `${label}: ${names.join(', ')}`;
}

function formatDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}
