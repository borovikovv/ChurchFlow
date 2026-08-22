-- Additive only, so applying it cannot disturb a running API instance. Note that the
-- rename in 20260822160000 ships in the same release and is not backward compatible,
-- so that window is not actually protected any more.
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
