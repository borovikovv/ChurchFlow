-- CreateEnum
CREATE TYPE "CalendarServiceRole" AS ENUM (
  'PREACHER',
  'SERVICE_HOST',
  'WORSHIP_LEAD',
  'COMMUNION_LEAD'
);

-- CreateEnum
CREATE TYPE "MemberMinistry" AS ENUM (
  'PREACHING',
  'WORSHIP',
  'DEACON',
  'MINISTER',
  'TEACHER',
  'MISSIONARY',
  'EVANGELIST',
  'CHAPLAIN'
);

-- AlterTable
ALTER TABLE "calendar_preferences"
ALTER COLUMN "visible_event_types"
SET DEFAULT ARRAY['BIRTHDAY', 'ANNIVERSARY', 'TASK', 'EVENT', 'SERVICE']::"CalendarEventType"[];

-- Backfill
UPDATE "calendar_preferences"
SET "visible_event_types" = array_append("visible_event_types", 'SERVICE'::"CalendarEventType")
WHERE NOT ('SERVICE'::"CalendarEventType" = ANY("visible_event_types"));

-- CreateTable
CREATE TABLE "organization_member_ministries" (
  "organization_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "ministry" "MemberMinistry" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_member_ministries_pkey" PRIMARY KEY ("membership_id", "ministry")
);

-- CreateTable
CREATE TABLE "calendar_service_details" (
  "event_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "has_communion" BOOLEAN NOT NULL DEFAULT false,
  "bible_passage" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "calendar_service_details_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "calendar_service_participants" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "role" "CalendarServiceRole" NOT NULL,
  "membership_id" UUID,
  "custom_name" TEXT,
  "display_name_snapshot" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "calendar_service_participants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "calendar_service_participants_person_check" CHECK (
    ("membership_id" IS NOT NULL AND "custom_name" IS NULL)
    OR ("membership_id" IS NULL AND "custom_name" IS NOT NULL)
  )
);

-- CreateTable
CREATE TABLE "calendar_service_songs" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "order" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "calendar_service_songs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preacher_queue_entries" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "last_assigned_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "preacher_queue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_member_ministries_organization_id_ministry_idx"
ON "organization_member_ministries"("organization_id", "ministry");

-- CreateIndex
CREATE INDEX "organization_member_ministries_organization_id_membership_id_idx"
ON "organization_member_ministries"("organization_id", "membership_id");

-- CreateIndex
CREATE INDEX "calendar_service_details_organization_id_idx"
ON "calendar_service_details"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_service_participants_event_id_role_key"
ON "calendar_service_participants"("event_id", "role");

-- CreateIndex
CREATE INDEX "calendar_service_participants_organization_id_role_idx"
ON "calendar_service_participants"("organization_id", "role");

-- CreateIndex
CREATE INDEX "calendar_service_participants_membership_id_idx"
ON "calendar_service_participants"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_service_songs_event_id_order_key"
ON "calendar_service_songs"("event_id", "order");

-- CreateIndex
CREATE INDEX "calendar_service_songs_organization_id_idx"
ON "calendar_service_songs"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "preacher_queue_entries_organization_id_membership_id_key"
ON "preacher_queue_entries"("organization_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "preacher_queue_entries_organization_id_position_key"
ON "preacher_queue_entries"("organization_id", "position");

-- CreateIndex
CREATE INDEX "preacher_queue_entries_organization_id_active_position_idx"
ON "preacher_queue_entries"("organization_id", "active", "position");

-- AddForeignKey
ALTER TABLE "organization_member_ministries"
ADD CONSTRAINT "organization_member_ministries_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member_ministries"
ADD CONSTRAINT "organization_member_ministries_membership_id_fkey"
FOREIGN KEY ("membership_id") REFERENCES "organization_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_service_details"
ADD CONSTRAINT "calendar_service_details_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_service_details"
ADD CONSTRAINT "calendar_service_details_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_service_participants"
ADD CONSTRAINT "calendar_service_participants_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_service_participants"
ADD CONSTRAINT "calendar_service_participants_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "calendar_service_details"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_service_participants"
ADD CONSTRAINT "calendar_service_participants_membership_id_fkey"
FOREIGN KEY ("membership_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_service_songs"
ADD CONSTRAINT "calendar_service_songs_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_service_songs"
ADD CONSTRAINT "calendar_service_songs_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "calendar_service_details"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preacher_queue_entries"
ADD CONSTRAINT "preacher_queue_entries_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preacher_queue_entries"
ADD CONSTRAINT "preacher_queue_entries_membership_id_fkey"
FOREIGN KEY ("membership_id") REFERENCES "organization_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
