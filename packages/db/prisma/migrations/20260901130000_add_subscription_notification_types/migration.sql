-- AlterEnum
-- Postgres refuses to use a new enum value in the same transaction that adds it, so this
-- migration only adds the labels. Nothing writes them until the dunning job runs at runtime.
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_REQUIRED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_PAYMENT_FAILED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_RESTRICTED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_RENEWED';
