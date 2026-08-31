import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { appLocaleOrFallback, type AppLocale } from '@churchflow/shared';
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
import {
  NOTIFICATION_RETENTION_BATCH_SIZE,
  NOTIFICATION_RETENTION_MAX_BATCHES,
  type NotificationRetentionCutoffs,
} from './notification-retention';
import {
  isNotificationTitleKey,
  parseNotificationBodyMessage,
  renderNotificationBody,
  renderNotificationTitle,
  type NotificationBodyMessage,
  type NotificationTitleKey,
} from './notification-messages';
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

    const locale = membershipLocale(membership);
    const page = await this.notificationsRepository.listForUser(organizationId, actorUserId, query);

    return {
      items: page.items.map((notification) => notificationToItem(notification, locale)),
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

    const locale = membershipLocale(membership);
    const summary = await this.notificationsRepository.summaryForUser(organizationId, actorUserId);

    return {
      recentItems: summary.recentItems.map((notification) =>
        notificationToItem(notification, locale),
      ),
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

    return notificationToDetail(notification, membershipLocale(membership));
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
    const sentCounts = await this.dispatchToEnabledServices(input, result, 'assignmentsEnabled');

    return {
      createdCount: result.createdCount,
      notifiedMembershipIds: result.notifiedMembershipIds,
      ...sentCounts,
    };
  }

  async createServiceAssignedNotifications(input: ServiceAssignedNotificationInput) {
    const result = await this.notificationsRepository.createServiceAssignedNotifications(input);
    const sentCounts = await this.dispatchToEnabledServices(input, result, 'assignmentsEnabled');

    return {
      createdCount: result.createdCount,
      notifiedMembershipIds: result.notifiedMembershipIds,
      ...sentCounts,
    };
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

  async purgeExpiredNotifications(input: {
    cutoffs: NotificationRetentionCutoffs;
    dryRun: boolean;
  }) {
    const tiers = [
      { name: 'dismissed' as const, cutoff: input.cutoffs.read, onlyDismissed: true },
      {
        name: 'all' as const,
        cutoff: input.cutoffs.all,
        onlyDismissed: false,
        excludeDismissedBefore: input.cutoffs.read,
      },
    ];
    const result: Record<'dismissed' | 'all', number> = { dismissed: 0, all: 0 };

    for (const tier of tiers) {
      if (input.dryRun) {
        result[tier.name] = await this.notificationsRepository.countExpired({
          cutoff: tier.cutoff,
          onlyDismissed: tier.onlyDismissed,
          ...(tier.excludeDismissedBefore
            ? { excludeDismissedBefore: tier.excludeDismissedBefore }
            : {}),
        });
        continue;
      }

      const purged = await this.notificationsRepository.purgeExpired({
        cutoff: tier.cutoff,
        onlyDismissed: tier.onlyDismissed,
        batchSize: NOTIFICATION_RETENTION_BATCH_SIZE,
        maxBatches: NOTIFICATION_RETENTION_MAX_BATCHES,
      });
      result[tier.name] = purged.deletedCount;

      if (purged.exhausted) {
        this.logger.warn({
          event: 'Notification retention hit the batch limit before draining the backlog',
          tier: tier.name,
          cutoff: tier.cutoff.toISOString(),
          deletedCount: purged.deletedCount,
        });
      }
    }

    this.logger.log({
      event: input.dryRun
        ? 'Notification retention dry run completed'
        : 'Notification retention completed',
      dismissedCutoff: input.cutoffs.read.toISOString(),
      allCutoff: input.cutoffs.all.toISOString(),
      dismissedCount: result.dismissed,
      allCount: result.all,
    });

    return { dryRun: input.dryRun, dismissedCount: result.dismissed, allCount: result.all };
  }

  private async dispatchToEnabledServices(
    input: {
      organizationId: string;
      titleKey: NotificationTitleKey;
      bodyMessage: NotificationBodyMessage | null;
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
                  title: renderNotificationTitle(input.titleKey, recipient.locale),
                  body: input.bodyMessage
                    ? renderNotificationBody(input.bodyMessage, recipient.locale)
                    : null,
                  url: input.url,
                  notificationId: recipient.notificationId,
                  locale: recipient.locale,
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
          const targets = await this.telegramBotRepository.getNotificationTelegramDeliveries({
            organizationId: input.organizationId,
            recipientUserIds: result.deliveryRecipients
              .filter((recipient) => recipient.telegramEnabled)
              .map((recipient) => recipient.userId),
            notificationByRecipientUserId: result.notificationByRecipientUserId,
            url: input.url,
            preferenceKey,
          });

          await Promise.all(
            targets.map((target) =>
              this.telegramBotService.deliverNotification({
                ...target,
                title: renderNotificationTitle(input.titleKey, target.locale),
                body: input.bodyMessage
                  ? renderNotificationBody(input.bodyMessage, target.locale)
                  : null,
              }),
            ),
          );

          return targets.length;
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

    return notificationToItem(notification, membershipLocale(membership));
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
    assignmentsEnabled: preferences.assignmentsEnabled,
    remindersEnabled: preferences.remindersEnabled,
    birthdayDigestEnabled: preferences.birthdayDigestEnabled,
    prayerRequestsEnabled: preferences.prayerRequestsEnabled,
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

function membershipLocale(membership: { user: { locale: string } | null }): AppLocale {
  return appLocaleOrFallback(membership.user?.locale);
}

function notificationToItem(
  notification: NotificationRecord,
  locale: AppLocale,
): NotificationListItem {
  return {
    id: notification.id,
    organizationId: notification.organizationId,
    type: notification.type,
    title: isNotificationTitleKey(notification.titleKey)
      ? renderNotificationTitle(notification.titleKey, locale)
      : notification.title,
    body: notificationBodyText(notification, locale),
    url: notification.url,
    entityType: notification.entityType,
    entityId: notification.entityId,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

function notificationBodyText(
  notification: { body: string | null; bodyMessage: unknown },
  locale: AppLocale,
): string | null {
  const message = parseNotificationBodyMessage(notification.bodyMessage);

  return message ? renderNotificationBody(message, locale) : notification.body;
}

function notificationToDetail(
  notification: NotificationDetailRecord,
  locale: AppLocale,
): NotificationDetail {
  return {
    ...notificationToItem(notification, locale),
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
