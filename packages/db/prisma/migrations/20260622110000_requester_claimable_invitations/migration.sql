CREATE TYPE "InvitationMode" AS ENUM ('targeted_telegram', 'claimable_link');

ALTER TABLE "organization_invitations"
  ADD COLUMN "mode" "InvitationMode" NOT NULL DEFAULT 'targeted_telegram',
  ADD COLUMN "claimed_by_user_id" UUID,
  ADD COLUMN "claimed_at" TIMESTAMP(3),
  ALTER COLUMN "target_provider" DROP NOT NULL,
  ALTER COLUMN "target_provider_account_id" DROP NOT NULL;

ALTER TABLE "organization_requests"
  ADD COLUMN "requested_by_user_id" UUID,
  ALTER COLUMN "contact_email" DROP NOT NULL,
  ALTER COLUMN "contact_telegram_id" DROP NOT NULL;

ALTER TABLE "organization_invitations"
  ADD CONSTRAINT "organization_invitations_claimed_by_user_id_fkey"
  FOREIGN KEY ("claimed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organization_requests"
  ADD CONSTRAINT "organization_requests_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "org_inv_target_status_key";
DROP INDEX IF EXISTS "org_inv_target_lookup_idx";
DROP INDEX IF EXISTS "org_inv_target_status_exp_idx";

CREATE UNIQUE INDEX "org_inv_target_status_key"
  ON "organization_invitations"("organization_id", "target_provider", "target_provider_account_id", "status");

CREATE INDEX "org_inv_target_lookup_idx"
  ON "organization_invitations"("target_provider", "target_provider_account_id");

CREATE INDEX "org_inv_target_status_exp_idx"
  ON "organization_invitations"("organization_id", "target_provider", "target_provider_account_id", "status", "expires_at");

CREATE INDEX "organization_invitations_mode_status_expires_at_idx"
  ON "organization_invitations"("mode", "status", "expires_at");

CREATE INDEX "organization_invitations_claimed_by_user_id_idx"
  ON "organization_invitations"("claimed_by_user_id");

CREATE INDEX "organization_requests_requested_by_user_id_idx"
  ON "organization_requests"("requested_by_user_id");
