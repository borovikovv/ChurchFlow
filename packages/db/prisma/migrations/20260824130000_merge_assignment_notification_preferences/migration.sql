ALTER TABLE "notification_preferences"
  RENAME COLUMN "task_assigned_enabled" TO "assignments_enabled";

UPDATE "notification_preferences"
SET "assignments_enabled" = "assignments_enabled" OR "service_assigned_enabled";

ALTER TABLE "notification_preferences"
  DROP COLUMN "service_assigned_enabled";

ALTER TABLE "notification_preferences"
  ADD COLUMN "prayer_requests_enabled" BOOLEAN NOT NULL DEFAULT true;
