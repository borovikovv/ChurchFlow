-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "OrganizationMemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "OrganizationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "OrganizationRole" ADD VALUE IF NOT EXISTS 'VIEWER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "platform_role" "PlatformRole" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "organizations"
  ADD COLUMN "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "suspended_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "organization_members"
  ADD COLUMN "status" "OrganizationMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "removed_at" TIMESTAMP(3);

UPDATE "organization_members"
SET "status" = 'REMOVED',
    "removed_at" = COALESCE("deleted_at", "updated_at")
WHERE "deleted_at" IS NOT NULL;

-- AlterTable
ALTER TABLE "organization_invitations"
  ADD COLUMN "revoked_at" TIMESTAMP(3);

UPDATE "organization_invitations"
SET "revoked_at" = COALESCE("updated_at", "created_at")
WHERE "status" = 'REVOKED';

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE TEXT USING "action"::TEXT;

-- CreateTable
CREATE TABLE "organization_requests" (
  "id" UUID NOT NULL,
  "organization_name" TEXT NOT NULL,
  "organization_slug" TEXT,
  "contact_name" TEXT NOT NULL,
  "contact_email" CITEXT NOT NULL,
  "contact_phone" TEXT,
  "message" TEXT,
  "status" "OrganizationRequestStatus" NOT NULL DEFAULT 'PENDING',
  "approved_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "reviewed_by_user_id" UUID,
  "created_organization_id" UUID,
  "rejection_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

-- CreateIndex
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members"("organization_id");

-- CreateIndex
CREATE INDEX "organization_members_organization_id_status_idx" ON "organization_members"("organization_id", "status");

-- CreateIndex
CREATE INDEX "organization_invitations_organization_id_idx" ON "organization_invitations"("organization_id");

-- CreateIndex
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations"("email");

-- CreateIndex
CREATE INDEX "organization_invitations_expires_at_idx" ON "organization_invitations"("expires_at");

-- CreateIndex
CREATE INDEX "organization_invitations_organization_id_email_status_expires_at_idx" ON "organization_invitations"("organization_id", "email", "status", "expires_at");

-- CreateIndex
CREATE INDEX "organization_requests_status_idx" ON "organization_requests"("status");

-- CreateIndex
CREATE INDEX "organization_requests_contact_email_idx" ON "organization_requests"("contact_email");

-- CreateIndex
CREATE INDEX "organization_requests_created_at_idx" ON "organization_requests"("created_at");

-- AddForeignKey
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_created_organization_id_fkey" FOREIGN KEY ("created_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
