-- ChurchFlow AI: conversations, per-request telemetry, per-model-call token usage and cost, tool
-- executions awaiting or past user confirmation, and the monthly per-organization action allowance.

-- CreateEnum
CREATE TYPE "AiRequestKind" AS ENUM ('MESSAGE', 'APPROVAL');

-- CreateEnum
CREATE TYPE "AiRequestStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiCostSource" AS ENUM ('PROVIDER_REPORTED', 'PRICE_TABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AiToolRisk" AS ENUM ('READ', 'WRITE', 'DESTRUCTIVE');

-- CreateEnum
CREATE TYPE "AiToolExecutionStatus" AS ENUM ('PENDING_APPROVAL', 'REJECTED', 'EXECUTING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" VARCHAR(20) NOT NULL DEFAULT 'web',
    "title" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "client_id" VARCHAR(128) NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "position" INTEGER NOT NULL,
    "parts" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "conversation_id" UUID,
    "action_request_id" UUID,
    "client_message_id" VARCHAR(128),
    "kind" "AiRequestKind" NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model" VARCHAR(120) NOT NULL,
    "status" "AiRequestStatus" NOT NULL DEFAULT 'RUNNING',
    "counted_against_quota" BOOLEAN NOT NULL DEFAULT false,
    "billing_period_start" TIMESTAMP(3) NOT NULL,
    "tool_call_count" INTEGER NOT NULL DEFAULT 0,
    "tool_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "latency_ms" INTEGER,
    "error_code" VARCHAR(80),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_model_usage" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "step_index" INTEGER NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model" VARCHAR(120) NOT NULL,
    "billing_period_start" TIMESTAMP(3) NOT NULL,
    "input_tokens" INTEGER,
    "cached_input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "reasoning_tokens" INTEGER,
    "total_tokens" INTEGER,
    "cost_usd" DECIMAL(14,8),
    "cost_source" "AiCostSource" NOT NULL,
    "pricing_version" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_model_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_tool_executions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "conversation_id" UUID,
    "request_id" UUID,
    "tool_call_id" VARCHAR(128) NOT NULL,
    "tool_name" VARCHAR(64) NOT NULL,
    "risk" "AiToolRisk" NOT NULL,
    "input" JSONB NOT NULL,
    "status" "AiToolExecutionStatus" NOT NULL,
    "approval_id" VARCHAR(128),
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMP(3),
    "result_summary" VARCHAR(500),
    "error_message" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_tool_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_counters" (
    "organization_id" UUID NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_counters_pkey" PRIMARY KEY ("organization_id","period_start")
);

-- CreateIndex
CREATE INDEX "ai_conversations_organization_id_user_id_updated_at_idx" ON "ai_conversations"("organization_id", "user_id", "updated_at");

-- CreateIndex
CREATE INDEX "ai_conversations_user_id_idx" ON "ai_conversations"("user_id");

-- CreateIndex
CREATE INDEX "ai_conversations_updated_at_idx" ON "ai_conversations"("updated_at");

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_position_idx" ON "ai_messages"("conversation_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ai_messages_conversation_id_client_id_key" ON "ai_messages"("conversation_id", "client_id");

-- CreateIndex
CREATE INDEX "ai_requests_organization_id_billing_period_start_idx" ON "ai_requests"("organization_id", "billing_period_start");

-- CreateIndex
CREATE INDEX "ai_requests_organization_id_started_at_idx" ON "ai_requests"("organization_id", "started_at");

-- CreateIndex
CREATE INDEX "ai_requests_action_request_id_idx" ON "ai_requests"("action_request_id");

-- CreateIndex
CREATE INDEX "ai_requests_user_id_idx" ON "ai_requests"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_requests_conversation_id_client_message_id_key" ON "ai_requests"("conversation_id", "client_message_id");

-- CreateIndex
CREATE INDEX "ai_model_usage_organization_id_billing_period_start_idx" ON "ai_model_usage"("organization_id", "billing_period_start");

-- CreateIndex
CREATE INDEX "ai_model_usage_billing_period_start_idx" ON "ai_model_usage"("billing_period_start");

-- CreateIndex
CREATE INDEX "ai_model_usage_user_id_idx" ON "ai_model_usage"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_usage_request_id_step_index_key" ON "ai_model_usage"("request_id", "step_index");

-- CreateIndex
CREATE INDEX "ai_tool_executions_conversation_id_tool_call_id_idx" ON "ai_tool_executions"("conversation_id", "tool_call_id");

-- CreateIndex
CREATE INDEX "ai_tool_executions_organization_id_created_at_idx" ON "ai_tool_executions"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_tool_executions_user_id_idx" ON "ai_tool_executions"("user_id");

-- CreateIndex
CREATE INDEX "ai_tool_executions_decided_by_user_id_idx" ON "ai_tool_executions"("decided_by_user_id");

-- CreateIndex
CREATE INDEX "ai_tool_executions_request_id_idx" ON "ai_tool_executions"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_tool_executions_conversation_id_approval_id_key" ON "ai_tool_executions"("conversation_id", "approval_id");

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_action_request_id_fkey" FOREIGN KEY ("action_request_id") REFERENCES "ai_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_usage" ADD CONSTRAINT "ai_model_usage_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "ai_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_usage" ADD CONSTRAINT "ai_model_usage_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_usage" ADD CONSTRAINT "ai_model_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_executions" ADD CONSTRAINT "ai_tool_executions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_executions" ADD CONSTRAINT "ai_tool_executions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_executions" ADD CONSTRAINT "ai_tool_executions_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_executions" ADD CONSTRAINT "ai_tool_executions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_executions" ADD CONSTRAINT "ai_tool_executions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "ai_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_counters" ADD CONSTRAINT "ai_usage_counters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

