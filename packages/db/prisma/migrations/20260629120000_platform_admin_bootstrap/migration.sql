CREATE TABLE "platform_admin_bootstrap_tokens" (
  "id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "consumed_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "platform_admin_bootstrap_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_admin_bootstrap_tokens_token_hash_key"
  ON "platform_admin_bootstrap_tokens"("token_hash");

CREATE INDEX "platform_admin_bootstrap_tokens_expires_at_idx"
  ON "platform_admin_bootstrap_tokens"("expires_at");

CREATE INDEX "platform_admin_bootstrap_tokens_consumed_by_user_id_idx"
  ON "platform_admin_bootstrap_tokens"("consumed_by_user_id");

ALTER TABLE "platform_admin_bootstrap_tokens"
  ADD CONSTRAINT "platform_admin_bootstrap_tokens_consumed_by_user_id_fkey"
  FOREIGN KEY ("consumed_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
