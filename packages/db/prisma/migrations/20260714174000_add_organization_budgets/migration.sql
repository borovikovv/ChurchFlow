CREATE TYPE "BudgetGroup" AS ENUM (
  'INCOME',
  'CURRENCY_EXCHANGE',
  'FACILITY',
  'TABLES',
  'PASTORS',
  'DISCIPLESHIP',
  'EVANGELISM',
  'OTHER'
);

CREATE TYPE "BudgetCategoryType" AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE "budget_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "group" "BudgetGroup" NOT NULL,
  "type" "BudgetCategoryType" NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "budget_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "budget_months" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "budget_months_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "budget_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "month_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "amount_uah" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "amount_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "amount_eur" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "budget_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "budget_categories_organization_id_group_order_idx"
  ON "budget_categories"("organization_id", "group", "order");

CREATE INDEX "budget_categories_organization_id_deleted_at_idx"
  ON "budget_categories"("organization_id", "deleted_at");

CREATE UNIQUE INDEX "budget_months_organization_id_year_month_key"
  ON "budget_months"("organization_id", "year", "month");

CREATE INDEX "budget_months_organization_id_year_idx"
  ON "budget_months"("organization_id", "year");

CREATE UNIQUE INDEX "budget_entries_month_id_category_id_key"
  ON "budget_entries"("month_id", "category_id");

CREATE INDEX "budget_entries_category_id_idx" ON "budget_entries"("category_id");

ALTER TABLE "budget_categories"
  ADD CONSTRAINT "budget_categories_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "budget_months"
  ADD CONSTRAINT "budget_months_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "budget_entries"
  ADD CONSTRAINT "budget_entries_month_id_fkey"
  FOREIGN KEY ("month_id") REFERENCES "budget_months"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "budget_entries"
  ADD CONSTRAINT "budget_entries_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "budget_categories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
