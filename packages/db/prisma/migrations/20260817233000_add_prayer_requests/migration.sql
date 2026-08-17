ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PRAYER_REQUEST_CREATED';

CREATE TABLE IF NOT EXISTS "prayer_requests" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "author_user_id" UUID,
  "author_membership_id" UUID,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "archived_at" TIMESTAMP(3),
  "archived_by_user_id" UUID,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "prayer_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "prayer_requests_organization_id_archived_at_created_at_idx"
  ON "prayer_requests"("organization_id", "archived_at", "created_at");

CREATE INDEX IF NOT EXISTS "prayer_requests_organization_id_author_user_id_idx"
  ON "prayer_requests"("organization_id", "author_user_id");

CREATE INDEX IF NOT EXISTS "prayer_requests_organization_id_deleted_at_idx"
  ON "prayer_requests"("organization_id", "deleted_at");

CREATE INDEX IF NOT EXISTS "prayer_requests_author_membership_id_idx"
  ON "prayer_requests"("author_membership_id");

ALTER TABLE "prayer_requests"
  ADD CONSTRAINT "prayer_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "prayer_requests"
  ADD CONSTRAINT "prayer_requests_author_user_id_fkey"
  FOREIGN KEY ("author_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prayer_requests"
  ADD CONSTRAINT "prayer_requests_author_membership_id_fkey"
  FOREIGN KEY ("author_membership_id") REFERENCES "organization_members"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prayer_requests"
  ADD CONSTRAINT "prayer_requests_archived_by_user_id_fkey"
  FOREIGN KEY ("archived_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
