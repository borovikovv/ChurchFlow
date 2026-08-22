-- Additive only: the API instance still running during a deploy keeps reading
-- "refresh_token_hash", so the column is mapped in Prisma rather than renamed.
CREATE TYPE "SessionRevokeReason" AS ENUM ('logout', 'admin', 'expired', 'user_deleted');

ALTER TABLE "sessions"
  ADD COLUMN "device_name" TEXT,
  ADD COLUMN "last_used_at" TIMESTAMP(3),
  ADD COLUMN "absolute_expires_at" TIMESTAMP(3),
  ADD COLUMN "revoked_reason" "SessionRevokeReason";

UPDATE "sessions" SET "absolute_expires_at" = "expires_at";

ALTER TABLE "sessions"
  ALTER COLUMN "absolute_expires_at" SET NOT NULL;

CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");
