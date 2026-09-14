-- CreateTable
-- One row per order LiqPay still has to stop charging. The single slot it replaces could only
-- remember one order, so a cancellation LiqPay accepted cleared an unrelated failed unsubscribe
-- and left that order charging the card with nothing in the system aware of it.
CREATE TABLE "billing_unsubscribe_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "order_id" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_unsubscribe_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_unsubscribe_requests_order_id_key" ON "billing_unsubscribe_requests"("order_id");

-- CreateIndex
CREATE INDEX "billing_unsubscribe_requests_organization_id_idx" ON "billing_unsubscribe_requests"("organization_id");

-- CreateIndex
CREATE INDEX "billing_unsubscribe_requests_subscription_id_idx" ON "billing_unsubscribe_requests"("subscription_id");

-- CreateIndex
CREATE INDEX "billing_unsubscribe_requests_resolved_at_idx" ON "billing_unsubscribe_requests"("resolved_at");

-- AddForeignKey
ALTER TABLE "billing_unsubscribe_requests" ADD CONSTRAINT "billing_unsubscribe_requests_subscription_id_organization_id_fkey" FOREIGN KEY ("subscription_id", "organization_id") REFERENCES "subscriptions"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill before the column goes: an order queued under the old shape is still charging a card
-- at LiqPay, and dropping it would leave nothing that knows to keep asking LiqPay to stop.
INSERT INTO "billing_unsubscribe_requests" (
    "id",
    "organization_id",
    "subscription_id",
    "order_id",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    "organization_id",
    "id",
    "pending_unsubscribe_order_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "subscriptions"
WHERE "pending_unsubscribe_order_id" IS NOT NULL;

-- DropIndex
DROP INDEX "subscriptions_pending_unsubscribe_order_id_idx";

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "pending_unsubscribe_order_id";
