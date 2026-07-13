import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ListNotificationsQuery,
  NotificationPreferences,
  NotificationListItem,
  NotificationsPage,
  NotificationsSummary,
  UpdateNotificationPreferencesInput,
} from '@churchflow/shared';
import {
  NotificationsRepository,
  type NotificationPreferenceRecord,
  type NotificationRecord,
  type TaskAssignedNotificationInput,
  type TelegramNotificationBindingRecord,
} from './repositories/notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

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
    return this.notificationsRepository.createTaskAssignedNotifications(input);
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
