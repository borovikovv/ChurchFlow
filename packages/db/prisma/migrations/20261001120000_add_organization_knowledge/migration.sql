-- CreateEnum
CREATE TYPE "KnowledgeCategory" AS ENUM ('TRADITION', 'INSTRUCTION', 'AGREEMENT', 'MINISTRY', 'THEOLOGY', 'OTHER');

-- CreateEnum
CREATE TYPE "KnowledgeVisibility" AS ENUM ('MEMBERS', 'ADMINS', 'OWNER');

-- CreateEnum
CREATE TYPE "ImportantDateRuleKind" AS ENUM ('FIXED', 'NTH_WEEKDAY');

-- CreateTable
CREATE TABLE "knowledge_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "KnowledgeCategory" NOT NULL DEFAULT 'OTHER',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "KnowledgeVisibility" NOT NULL DEFAULT 'MEMBERS',
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "important_dates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "rule_kind" "ImportantDateRuleKind" NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER,
    "weekday" INTEGER,
    "nth" INTEGER,
    "reminder_lead_days" INTEGER,
    "visibility" "KnowledgeVisibility" NOT NULL DEFAULT 'MEMBERS',
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "important_dates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_entries_organization_id_pinned_updated_at_idx" ON "knowledge_entries"("organization_id", "pinned", "updated_at");

-- CreateIndex
CREATE INDEX "knowledge_entries_created_by_id_idx" ON "knowledge_entries"("created_by_id");

-- CreateIndex
CREATE INDEX "knowledge_entries_updated_by_id_idx" ON "knowledge_entries"("updated_by_id");

-- CreateIndex
CREATE INDEX "important_dates_organization_id_month_idx" ON "important_dates"("organization_id", "month");

-- CreateIndex
CREATE INDEX "important_dates_created_by_id_idx" ON "important_dates"("created_by_id");

-- CreateIndex
CREATE INDEX "important_dates_updated_by_id_idx" ON "important_dates"("updated_by_id");

-- AddForeignKey
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "important_dates" ADD CONSTRAINT "important_dates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "important_dates" ADD CONSTRAINT "important_dates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "important_dates" ADD CONSTRAINT "important_dates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
