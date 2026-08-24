import {
  listNotificationsQuerySchema,
  updateNotificationPreferencesSchema,
} from '@churchflow/shared';
import type {
  ListNotificationsQuery,
  UpdateNotificationPreferencesInput,
} from '@churchflow/shared';

export class ListNotificationsQueryDto implements ListNotificationsQuery {
  static readonly schema = listNotificationsQuerySchema;

  cursor?: string;
  limit!: number;
}

export class UpdateNotificationPreferencesDto implements UpdateNotificationPreferencesInput {
  static readonly schema = updateNotificationPreferencesSchema;

  inAppEnabled!: boolean;
  emailEnabled!: boolean;
  telegramEnabled!: boolean;
  assignmentsEnabled!: boolean;
  remindersEnabled!: boolean;
  birthdayDigestEnabled!: boolean;
  prayerRequestsEnabled!: boolean;
  organizationUpdatesEnabled!: boolean;
  timeZone?: string | null;
}
