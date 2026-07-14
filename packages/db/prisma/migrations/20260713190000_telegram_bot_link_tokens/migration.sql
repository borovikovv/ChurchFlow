CREATE TABLE "telegram_notification_link_tokens" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "telegram_notification_link_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telegram_notification_link_tokens_token_hash_key"
  ON "telegram_notification_link_tokens"("token_hash");

CREATE INDEX "telegram_notification_link_tokens_user_id_idx"
  ON "telegram_notification_link_tokens"("user_id");

CREATE INDEX "telegram_notification_link_tokens_expires_at_idx"
  ON "telegram_notification_link_tokens"("expires_at");

ALTER TABLE "telegram_notification_link_tokens"
  ADD CONSTRAINT "telegram_notification_link_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
