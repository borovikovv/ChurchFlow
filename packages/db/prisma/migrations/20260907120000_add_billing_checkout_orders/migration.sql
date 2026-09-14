-- CreateEnum
CREATE TYPE "BillingCheckoutStatus" AS ENUM ('PROPOSED', 'PAID', 'ABANDONED');

-- CreateTable
-- One row per offered checkout. The single pending slot it replaces could only remember the
-- latest order, so a payment for an order that had since been superseded matched nothing.
CREATE TABLE "billing_checkout_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "usd_reference" DECIMAL(12,2) NOT NULL,
    "fx_rate_used_at" TIMESTAMP(3) NOT NULL,
    "status" "BillingCheckoutStatus" NOT NULL DEFAULT 'PROPOSED',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_checkout_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_checkout_orders_order_id_key" ON "billing_checkout_orders"("order_id");

-- CreateIndex
CREATE INDEX "billing_checkout_orders_organization_id_idx" ON "billing_checkout_orders"("organization_id");

-- CreateIndex
CREATE INDEX "billing_checkout_orders_subscription_id_status_idx" ON "billing_checkout_orders"("subscription_id", "status");

-- AddForeignKey
ALTER TABLE "billing_checkout_orders" ADD CONSTRAINT "billing_checkout_orders_subscription_id_organization_id_fkey" FOREIGN KEY ("subscription_id", "organization_id") REFERENCES "subscriptions"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill before the columns go: a checkout offered under the old shape is still open at LiqPay,
-- and dropping it would make a payment for it unmatchable in exactly the way this table exists to
-- prevent. Currency and the USD reference were not stored per checkout, so they take the values
-- every offered checkout was priced with.
INSERT INTO "billing_checkout_orders" (
    "id",
    "organization_id",
    "subscription_id",
    "order_id",
    "amount_minor",
    "currency",
    "usd_reference",
    "fx_rate_used_at",
    "status",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    "organization_id",
    "id",
    "pending_liqpay_order_id",
    COALESCE("pending_amount_minor", "amount_minor", 0),
    'UAH',
    4.5,
    COALESCE("pending_fx_rate_used_at", "fx_rate_used_at", "created_at"),
    'PROPOSED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "subscriptions"
WHERE "pending_liqpay_order_id" IS NOT NULL;

-- DropIndex
DROP INDEX "subscriptions_pending_liqpay_order_id_key";

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "pending_liqpay_order_id",
DROP COLUMN "pending_amount_minor",
DROP COLUMN "pending_fx_rate_used_at";
