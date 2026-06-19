DELETE FROM "auth_accounts"
WHERE "provider" = 'email';

DROP TABLE IF EXISTS "email_login_tokens";

CREATE TYPE "AuthProvider_new" AS ENUM ('telegram', 'webauthn', 'google', 'apple');

ALTER TABLE "auth_accounts"
  ALTER COLUMN "provider" TYPE "AuthProvider_new"
  USING ("provider"::text::"AuthProvider_new");

DROP TYPE "AuthProvider";

ALTER TYPE "AuthProvider_new" RENAME TO "AuthProvider";
