-- CreateEnum
CREATE TYPE "EmailLoginTokenPurpose" AS ENUM ('sign_in', 'verify_email');

-- CreateEnum
CREATE TYPE "WebAuthnChallengeType" AS ENUM ('registration', 'authentication');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuthProvider" ADD VALUE 'email';
ALTER TYPE "AuthProvider" ADD VALUE 'passkey';

-- AlterTable
ALTER TABLE "auth_accounts" ADD COLUMN     "aaguid" TEXT,
ADD COLUMN     "backed_up" BOOLEAN,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "sign_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "transports" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "email_login_tokens" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "user_id" UUID,
    "purpose" "EmailLoginTokenPurpose" NOT NULL DEFAULT 'sign_in',
    "token_hash" TEXT NOT NULL,
    "code_hash" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "redirect_to" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "request_ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webauthn_challenges" (
    "id" UUID NOT NULL,
    "challenge_hash" TEXT NOT NULL,
    "type" "WebAuthnChallengeType" NOT NULL,
    "user_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_login_tokens_token_hash_key" ON "email_login_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_login_tokens_email_expires_at_idx" ON "email_login_tokens"("email", "expires_at");

-- CreateIndex
CREATE INDEX "email_login_tokens_user_id_idx" ON "email_login_tokens"("user_id");

-- CreateIndex
CREATE INDEX "email_login_tokens_expires_at_idx" ON "email_login_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "webauthn_challenges_challenge_hash_key" ON "webauthn_challenges"("challenge_hash");

-- CreateIndex
CREATE INDEX "webauthn_challenges_user_id_idx" ON "webauthn_challenges"("user_id");

-- CreateIndex
CREATE INDEX "webauthn_challenges_expires_at_idx" ON "webauthn_challenges"("expires_at");

-- AddForeignKey
ALTER TABLE "email_login_tokens" ADD CONSTRAINT "email_login_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webauthn_challenges" ADD CONSTRAINT "webauthn_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

