-- Redundant since the unique index was added over the same column.
DROP INDEX "sessions_refresh_token_hash_idx";

-- The column no longer holds a refresh token. This rename is not backward compatible:
-- the API instance still serving traffic while migrations run reads the old name, so
-- authenticated requests fail until the new containers take over.
ALTER TABLE "sessions" RENAME COLUMN "refresh_token_hash" TO "token_hash";

ALTER INDEX "sessions_refresh_token_hash_key" RENAME TO "sessions_token_hash_key";
