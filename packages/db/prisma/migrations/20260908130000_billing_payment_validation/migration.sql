CREATE INDEX "subscriptions_grace_ends_at_idx" ON "subscriptions"("grace_ends_at");
ALTER TABLE "billing_callbacks" ADD COLUMN "credited" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "issue" TEXT;
-- Previously accepted paid events must not credit the same payment again after deployment.
UPDATE "billing_callbacks" SET "credited" = true WHERE "id" IN (
  SELECT DISTINCT ON ("order_id", "payment_id") "id" FROM "billing_callbacks"
  WHERE lower(btrim("status")) IN ('success', 'subscribed', 'sandbox') ORDER BY "order_id", "payment_id", "created_at", "id"
);
CREATE UNIQUE INDEX "billing_callbacks_payment_credit_key" ON "billing_callbacks"("order_id", "payment_id") WHERE "credited" = true;
