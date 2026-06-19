DELETE FROM "auth_accounts"
WHERE "provider" = 'webauthn';

CREATE TYPE "AuthProvider_new" AS ENUM ('telegram');

ALTER TABLE "auth_accounts"
  ALTER COLUMN "provider" TYPE "AuthProvider_new"
  USING ("provider"::text::"AuthProvider_new");

DROP TYPE "AuthProvider";

ALTER TYPE "AuthProvider_new" RENAME TO "AuthProvider";
