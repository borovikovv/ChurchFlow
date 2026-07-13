CREATE TYPE "NotificationType" AS ENUM (
  'TASK_ASSIGNED',
  'TASK_UPDATED',
  'TASK_DUE_REMINDER',
  'SERVICE_ASSIGNED',
  'SERVICE_REMINDER',
  'ORGANIZATION_ANNOUNCEMENT'
);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "recipient_user_id" UUID NOT NULL,
  "recipient_membership_id" UUID,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "url" TEXT,
  "entity_type" TEXT,
  "entity_id" UUID,
  "read_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_recipient_user_id_created_at_idx"
  ON "notifications"("recipient_user_id", "created_at");

CREATE INDEX "notifications_recipient_user_id_read_at_idx"
  ON "notifications"("recipient_user_id", "read_at");

CREATE INDEX "notifications_organization_id_recipient_user_id_created_at_idx"
  ON "notifications"("organization_id", "recipient_user_id", "created_at");

CREATE INDEX "notifications_entity_type_entity_id_idx"
  ON "notifications"("entity_type", "entity_id");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_recipient_user_id_fkey"
  FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_recipient_membership_id_fkey"
  FOREIGN KEY ("recipient_membership_id") REFERENCES "organization_members"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "notification_preferences" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
  "email_enabled" BOOLEAN NOT NULL DEFAULT false,
  "telegram_enabled" BOOLEAN NOT NULL DEFAULT false,
  "task_assigned_enabled" BOOLEAN NOT NULL DEFAULT true,
  "service_assigned_enabled" BOOLEAN NOT NULL DEFAULT true,
  "reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_preferences_organization_id_user_id_key"
  ON "notification_preferences"("organization_id", "user_id");

CREATE INDEX "notification_preferences_user_id_idx"
  ON "notification_preferences"("user_id");

ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "telegram_notification_bindings" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "telegram_user_id" TEXT NOT NULL,
  "telegram_chat_id" TEXT NOT NULL,
  "username" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "blocked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "telegram_notification_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telegram_notification_bindings_user_id_key"
  ON "telegram_notification_bindings"("user_id");

CREATE UNIQUE INDEX "telegram_notification_bindings_telegram_user_id_key"
  ON "telegram_notification_bindings"("telegram_user_id");

CREATE INDEX "telegram_notification_bindings_telegram_chat_id_idx"
  ON "telegram_notification_bindings"("telegram_chat_id");

ALTER TABLE "telegram_notification_bindings"
  ADD CONSTRAINT "telegram_notification_bindings_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
