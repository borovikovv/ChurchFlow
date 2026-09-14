-- LiqPay reports the stages of one payment under the same payment id: wait_secure or processing
-- first, then success or failure. Deduplicating on (order_id, payment_id) alone made the row
-- written for the undecided stage swallow the decisive one, so a 3DS payment was taken from the
-- card while the subscription stayed PENDING. Widening the key keeps a redelivery of the same
-- stage a duplicate, which is the case idempotency is actually for.

-- DropIndex
DROP INDEX "billing_callbacks_order_id_payment_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "billing_callbacks_order_id_payment_id_status_key" ON "billing_callbacks"("order_id", "payment_id", "status");
