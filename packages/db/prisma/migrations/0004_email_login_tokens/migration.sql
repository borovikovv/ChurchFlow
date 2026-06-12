CREATE TABLE "email_login_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" CITEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "redirect_to" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_login_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_login_tokens_token_hash_key" ON "email_login_tokens"("token_hash");
CREATE INDEX "email_login_tokens_email_idx" ON "email_login_tokens"("email");
CREATE INDEX "email_login_tokens_expires_at_idx" ON "email_login_tokens"("expires_at");
CREATE INDEX "email_login_tokens_used_at_idx" ON "email_login_tokens"("used_at");

ALTER TABLE "email_login_tokens"
  ADD CONSTRAINT "email_login_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
