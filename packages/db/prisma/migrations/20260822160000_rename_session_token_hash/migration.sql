-- Redundant since the unique index was added over the same column.
DROP INDEX "sessions_refresh_token_hash_idx";

-- The column no longer holds a refresh token. This rename is not backward compatible:
-- the API instance still serving traffic while migrations run reads the old name, so
-- authenticated requests fail until the new containers take over.
ALTER TABLE "sessions" RENAME COLUMN "refresh_token_hash" TO "token_hash";

ALTER INDEX "sessions_refresh_token_hash_key" RENAME TO "sessions_token_hash_key";

-- Every surviving row holds the hash of a refresh token, which the old scheme only ever
-- accepted at /auth/refresh. Left alone it would now authenticate directly as a session
-- token, and would show up as a phantom device for a browser that can no longer sign in.
UPDATE "sessions"
  SET "revoked_at" = now(), "revoked_reason" = 'expired'
  WHERE "revoked_at" IS NULL;
