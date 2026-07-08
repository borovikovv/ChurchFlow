-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('BIRTHDAY', 'ANNIVERSARY', 'TASK', 'EVENT');

-- CreateEnum
CREATE TYPE "CalendarEventReminder" AS ENUM ('ONE_HOUR', 'ONE_DAY', 'ONE_WEEK');

-- CreateEnum
CREATE TYPE "CalendarEventRepeatPeriod" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "organization_member_profiles"
ADD COLUMN "birthday" DATE,
ADD COLUMN "anniversary" DATE;

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "linked_membership_id" UUID,
    "image_asset_id" UUID,
    "type" "CalendarEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "reminder" "CalendarEventReminder",
    "repeat_period" "CalendarEventRepeatPeriod" NOT NULL DEFAULT 'NONE',
    "task_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_assignees" (
    "event_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_event_assignees_pkey" PRIMARY KEY ("event_id","membership_id")
);

-- CreateTable
CREATE TABLE "calendar_preferences" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "visible_event_types" "CalendarEventType"[] NOT NULL DEFAULT ARRAY['BIRTHDAY', 'ANNIVERSARY', 'TASK', 'EVENT']::"CalendarEventType"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_events_organization_id_starts_at_idx" ON "calendar_events"("organization_id", "starts_at");

-- CreateIndex
CREATE INDEX "calendar_events_organization_id_type_starts_at_idx" ON "calendar_events"("organization_id", "type", "starts_at");

-- CreateIndex
CREATE INDEX "calendar_events_organization_id_deleted_at_idx" ON "calendar_events"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "calendar_events_linked_membership_id_idx" ON "calendar_events"("linked_membership_id");

-- CreateIndex
CREATE INDEX "calendar_events_image_asset_id_idx" ON "calendar_events"("image_asset_id");

-- CreateIndex
CREATE INDEX "calendar_event_assignees_membership_id_idx" ON "calendar_event_assignees"("membership_id");

-- CreateIndex
CREATE INDEX "calendar_preferences_user_id_idx" ON "calendar_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_preferences_organization_id_user_id_key" ON "calendar_preferences"("organization_id", "user_id");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_linked_membership_id_fkey" FOREIGN KEY ("linked_membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_assignees" ADD CONSTRAINT "calendar_event_assignees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_assignees" ADD CONSTRAINT "calendar_event_assignees_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "organization_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_preferences" ADD CONSTRAINT "calendar_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_preferences" ADD CONSTRAINT "calendar_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
