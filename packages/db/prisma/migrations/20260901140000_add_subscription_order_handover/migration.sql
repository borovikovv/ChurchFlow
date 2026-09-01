-- AlterTable
-- A checkout that has not been paid for yet is kept beside the live subscription rather than
-- overwriting it, so abandoning the LiqPay page leaves the running subscription untouched.
ALTER TABLE "subscriptions" ADD COLUMN     "pending_liqpay_order_id" TEXT,
ADD COLUMN     "pending_amount_minor" INTEGER,
ADD COLUMN     "pending_fx_rate_used_at" TIMESTAMP(3),
ADD COLUMN     "pending_unsubscribe_order_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_pending_liqpay_order_id_key" ON "subscriptions"("pending_liqpay_order_id");

-- CreateIndex
CREATE INDEX "subscriptions_pending_unsubscribe_order_id_idx" ON "subscriptions"("pending_unsubscribe_order_id");
