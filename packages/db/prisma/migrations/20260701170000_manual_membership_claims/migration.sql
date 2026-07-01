CREATE TYPE "MembershipSource" AS ENUM (
  'EXISTING',
  'MANUAL',
  'INVITATION',
  'ORGANIZATION_APPROVAL'
);

CREATE TYPE "MembershipClaimStatus" AS ENUM (
  'PENDING',
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'REVOKED',
  'EXPIRED'
);

ALTER TABLE "organization_members"
  ADD COLUMN "source" "MembershipSource" NOT NULL DEFAULT 'EXISTING',
  ADD COLUMN "created_by_user_id" UUID,
  ADD COLUMN "claimed_at" TIMESTAMP(3);

UPDATE "organization_members"
SET "claimed_at" = "created_at"
WHERE "user_id" IS NOT NULL;

ALTER TABLE "organization_members"
  DROP CONSTRAINT "organization_members_user_id_fkey";

ALTER TABLE "organization_members"
  ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "organization_members"
  ADD CONSTRAINT "organization_members_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "organization_members_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "organization_members_created_by_user_id_idx"
  ON "organization_members"("created_by_user_id");

CREATE INDEX "organization_members_organization_id_source_idx"
  ON "organization_members"("organization_id", "source");

CREATE TABLE "organization_member_profiles" (
  "id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "display_name" TEXT NOT NULL,
  "email" CITEXT,
  "phone" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_member_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_member_profiles_membership_id_fkey"
    FOREIGN KEY ("membership_id") REFERENCES "organization_members"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "organization_member_profiles_membership_id_key"
  ON "organization_member_profiles"("membership_id");
CREATE INDEX "organization_member_profiles_email_idx"
  ON "organization_member_profiles"("email");
CREATE INDEX "organization_member_profiles_phone_idx"
  ON "organization_member_profiles"("phone");

INSERT INTO "organization_member_profiles" (
  "id",
  "membership_id",
  "display_name",
  "email",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  member."id",
  COALESCE(NULLIF(TRIM(app_user."displayName"), ''), app_user."email"::text, 'Member'),
  app_user."email",
  member."created_at",
  CURRENT_TIMESTAMP
FROM "organization_members" AS member
LEFT JOIN "users" AS app_user ON app_user."id" = member."user_id";

CREATE TABLE "membership_claims" (
  "id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "status" "MembershipClaimStatus" NOT NULL DEFAULT 'PENDING',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "requested_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "requested_by_user_id" UUID,
  "reviewed_by_user_id" UUID,
  "provider" "AuthProvider",
  "provider_account_id" TEXT,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "membership_claims_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "membership_claims_membership_id_fkey"
    FOREIGN KEY ("membership_id") REFERENCES "organization_members"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "membership_claims_requested_by_user_id_fkey"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "membership_claims_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "membership_claims_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "membership_claims_token_hash_key"
  ON "membership_claims"("token_hash");
CREATE INDEX "membership_claims_membership_id_status_idx"
  ON "membership_claims"("membership_id", "status");
CREATE INDEX "membership_claims_requested_by_user_id_idx"
  ON "membership_claims"("requested_by_user_id");
CREATE INDEX "membership_claims_expires_at_idx"
  ON "membership_claims"("expires_at");

CREATE UNIQUE INDEX "membership_claims_one_active_per_membership_key"
  ON "membership_claims"("membership_id")
  WHERE "status" IN ('PENDING', 'REQUESTED');
