-- AlterEnum
-- Postgres refuses to use a new enum value in the same transaction that adds it, so this
-- migration only adds the label. It is written when a complimentary grant stops the paid
-- subscription an organization was running, which until now happened silently.
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_CANCELED';
