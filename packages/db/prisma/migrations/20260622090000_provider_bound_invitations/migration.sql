-- CreateEnum
CREATE TYPE "InvitationTargetProvider" AS ENUM ('telegram', 'email', 'phone', 'google', 'apple');

-- AlterTable
ALTER TABLE "organization_invitations"
  ADD COLUMN "target_provider" "InvitationTargetProvider" NOT NULL DEFAULT 'telegram',
  ADD COLUMN "target_provider_account_id" TEXT,
  ADD COLUMN "target_display" TEXT;

UPDATE "organization_invitations"
SET
  "target_provider_account_id" = CONCAT('legacy-email:', "id"::TEXT),
  "target_display" = "email"
WHERE "target_provider_account_id" IS NULL;

ALTER TABLE "organization_invitations"
  ALTER COLUMN "target_provider_account_id" SET NOT NULL,
  ALTER COLUMN "target_provider" DROP DEFAULT;

-- Drop old email-bound uniqueness and lookup indexes.
DROP INDEX IF EXISTS "organization_invitations_organization_id_email_status_key";
DROP INDEX IF EXISTS "organization_invitations_organization_id_email_status_expires_at_idx";
DROP INDEX IF EXISTS "organization_invitations_organization_id_email_status_expir_idx";

-- CreateIndex
CREATE UNIQUE INDEX "org_inv_target_status_key"
  ON "organization_invitations"("organization_id", "target_provider", "target_provider_account_id", "status");

-- CreateIndex
CREATE INDEX "org_inv_target_lookup_idx"
  ON "organization_invitations"("target_provider", "target_provider_account_id");

-- CreateIndex
CREATE INDEX "org_inv_target_status_exp_idx"
  ON "organization_invitations"("organization_id", "target_provider", "target_provider_account_id", "status", "expires_at");

-- AlterTable
ALTER TABLE "organization_requests"
  ADD COLUMN "contact_telegram_id" TEXT,
  ADD COLUMN "contact_telegram_username" TEXT;

UPDATE "organization_requests"
SET "contact_telegram_id" = CONCAT('legacy-request:', "id"::TEXT)
WHERE "contact_telegram_id" IS NULL;

ALTER TABLE "organization_requests"
  ALTER COLUMN "contact_telegram_id" SET NOT NULL;
