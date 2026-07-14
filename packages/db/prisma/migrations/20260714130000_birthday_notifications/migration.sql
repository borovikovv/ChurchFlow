ALTER TYPE "NotificationType" ADD VALUE 'BIRTHDAY_DIGEST';

ALTER TABLE "notifications"
  ADD COLUMN "dedupe_key" TEXT;

ALTER TABLE "notification_preferences"
  ADD COLUMN "birthday_digest_enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "notifications_organization_id_recipient_user_id_type_dedupe_key_key"
  ON "notifications"("organization_id", "recipient_user_id", "type", "dedupe_key");
