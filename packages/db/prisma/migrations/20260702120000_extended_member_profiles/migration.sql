CREATE TYPE "OrganizationMemberRelationshipType" AS ENUM ('SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'OTHER');

ALTER TABLE "users"
  ADD COLUMN "baptized_at" DATE,
  ADD COLUMN "baptism_church_name" TEXT;

ALTER TABLE "organization_member_profiles"
  ADD COLUMN "member_since" DATE,
  ADD COLUMN "biography" TEXT,
  ADD COLUMN "family_notes" TEXT,
  ADD COLUMN "profile_photo_asset_id" UUID;

CREATE TABLE "organization_member_relationships" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "from_membership_id" UUID NOT NULL,
  "to_membership_id" UUID NOT NULL,
  "type" "OrganizationMemberRelationshipType" NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_member_relationships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_member_relationships_not_self" CHECK ("from_membership_id" <> "to_membership_id")
);

CREATE UNIQUE INDEX "organization_member_profiles_profile_photo_asset_id_key" ON "organization_member_profiles"("profile_photo_asset_id");
CREATE UNIQUE INDEX "organization_member_relationships_organization_id_from_membership_id_to_membership_id_type_key" ON "organization_member_relationships"("organization_id", "from_membership_id", "to_membership_id", "type");
CREATE INDEX "member_relationships_from_idx" ON "organization_member_relationships"("organization_id", "from_membership_id");
CREATE INDEX "member_relationships_to_idx" ON "organization_member_relationships"("organization_id", "to_membership_id");

ALTER TABLE "organization_member_profiles" ADD CONSTRAINT "organization_member_profiles_profile_photo_asset_id_fkey" FOREIGN KEY ("profile_photo_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organization_member_relationships" ADD CONSTRAINT "organization_member_relationships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_member_relationships" ADD CONSTRAINT "organization_member_relationships_from_membership_id_fkey" FOREIGN KEY ("from_membership_id") REFERENCES "organization_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_member_relationships" ADD CONSTRAINT "organization_member_relationships_to_membership_id_fkey" FOREIGN KEY ("to_membership_id") REFERENCES "organization_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
