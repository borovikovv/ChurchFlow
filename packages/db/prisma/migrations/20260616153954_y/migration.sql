/*
  Warnings:

  - The values [EDITOR] on the enum `OrganizationRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `deleted_at` on the `organization_members` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OrganizationRole_new" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
ALTER TABLE "public"."organization_invitations" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "public"."organization_members" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "organization_members" ALTER COLUMN "role" TYPE "OrganizationRole_new" USING ("role"::text::"OrganizationRole_new");
ALTER TABLE "organization_invitations" ALTER COLUMN "role" TYPE "OrganizationRole_new" USING ("role"::text::"OrganizationRole_new");
ALTER TYPE "OrganizationRole" RENAME TO "OrganizationRole_old";
ALTER TYPE "OrganizationRole_new" RENAME TO "OrganizationRole";
DROP TYPE "public"."OrganizationRole_old";
ALTER TABLE "organization_invitations" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
ALTER TABLE "organization_members" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
COMMIT;

-- AlterTable
ALTER TABLE "email_login_tokens" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organization_members" DROP COLUMN "deleted_at";

-- RenameIndex
ALTER INDEX "organization_invitations_organization_id_email_status_expires_a" RENAME TO "organization_invitations_organization_id_email_status_expir_idx";
