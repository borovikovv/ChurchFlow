ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "organization_updates_enabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "time_zone" VARCHAR(64);
