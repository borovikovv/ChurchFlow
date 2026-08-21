const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const NOTIFICATION_RETENTION_BATCH_SIZE = 5_000;

export const NOTIFICATION_RETENTION_MAX_BATCHES = 200;

export type NotificationRetentionConfig = {
  retentionDays: number;
  readRetentionDays: number;
};

export type NotificationRetentionCutoffs = {
  all: Date;
  read: Date;
};

export function resolveNotificationRetentionCutoffs(
  now: Date,
  config: NotificationRetentionConfig,
): NotificationRetentionCutoffs {
  return {
    all: subtractDays(now, config.retentionDays),
    read: subtractDays(now, config.readRetentionDays),
  };
}

function subtractDays(from: Date, days: number): Date {
  return new Date(from.getTime() - days * MS_PER_DAY);
}
