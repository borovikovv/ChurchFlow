-- When LiqPay says the event happened, which is not when it reached us. Deliveries are retried
-- and can arrive in an order the events did not, and without a time to compare them by a failure
-- delivered late walks a subscription that has since been paid for back into PAST_DUE.
ALTER TABLE "billing_callbacks" ADD COLUMN "event_at" TIMESTAMP(3);

-- Rows recorded before this column existed keep a NULL: they carry no ordering information, and
-- inventing one from `created_at` would order them by when the delivery arrived, which is the
-- very thing that cannot be trusted.
CREATE INDEX "billing_callbacks_subscription_id_event_at_idx" ON "billing_callbacks"("subscription_id", "event_at");
