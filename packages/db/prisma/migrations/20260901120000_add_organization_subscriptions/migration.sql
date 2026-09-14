-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'RESTRICTED', 'CANCELED');

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "amount_minor" INTEGER,
    "currency" VARCHAR(3),
    "usd_reference" DECIMAL(12,2),
    "fx_rate_used_at" TIMESTAMP(3),
    "restrict_after" TIMESTAMP(3),
    "grace_ends_at" TIMESTAMP(3),
    "current_period_ends_at" TIMESTAMP(3),
    "liqpay_order_id" TEXT,
    "liqpay_subscribed_at" TIMESTAMP(3),
    "card_mask" TEXT,
    "card_brand" TEXT,
    "card_expiry" TEXT,
    "is_exempt" BOOLEAN NOT NULL DEFAULT false,
    "exempt_reason" TEXT,
    "exempt_granted_by_user_id" UUID,
    "exempt_granted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_callbacks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "order_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_callbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_organization_id_key" ON "subscriptions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_liqpay_order_id_key" ON "subscriptions"("liqpay_order_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_status_grace_ends_at_idx" ON "subscriptions"("status", "grace_ends_at");

-- CreateIndex
CREATE INDEX "subscriptions_status_restrict_after_idx" ON "subscriptions"("status", "restrict_after");

-- CreateIndex
CREATE INDEX "subscriptions_exempt_granted_by_user_id_idx" ON "subscriptions"("exempt_granted_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_id_organization_id_key" ON "subscriptions"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_callbacks_order_id_payment_id_key" ON "billing_callbacks"("order_id", "payment_id");

-- CreateIndex
CREATE INDEX "billing_callbacks_organization_id_idx" ON "billing_callbacks"("organization_id");

-- CreateIndex
CREATE INDEX "billing_callbacks_subscription_id_idx" ON "billing_callbacks"("subscription_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_exempt_granted_by_user_id_fkey" FOREIGN KEY ("exempt_granted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_callbacks" ADD CONSTRAINT "billing_callbacks_subscription_id_organization_id_fkey" FOREIGN KEY ("subscription_id", "organization_id") REFERENCES "subscriptions"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill. Entitlement resolution treats a missing subscription row as "no entitlements",
-- so every organization must have one or it silently becomes unusable the moment
-- BILLING_ENFORCEMENT_ENABLED is turned on. Soft-deleted organizations are included too, so
-- the invariant is "one row per organization" with no exceptions to remember.
--
-- Organizations that already exist keep full write access for a 7-day transition window
-- (restrict_after). Organizations created after this migration get restrict_after = NULL and
-- are restricted from their first second, per the no-grandfathering rollout decision.
INSERT INTO "subscriptions" (
    "id",
    "organization_id",
    "status",
    "restrict_after",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    "id",
    'PENDING',
    NOW() + INTERVAL '7 days',
    NOW(),
    NOW()
FROM "organizations";
