-- AlterEnum
-- Postgres refuses to use a new enum value in the same transaction that adds it, so this
-- migration only adds the label. It is written for organization owners and admins when a
-- member requests access through a membership-claim link.
ALTER TYPE "NotificationType" ADD VALUE 'MEMBERSHIP_CLAIM_REQUESTED';
