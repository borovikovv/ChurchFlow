ALTER TYPE "OrganizationMemberStatus" ADD VALUE 'ARCHIVED';

ALTER TABLE "organization_members"
  ADD COLUMN "archived_at" TIMESTAMP(3);
