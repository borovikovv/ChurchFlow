-- Currency exchanges live in "budget_exchanges"; the legacy group and its categories are gone.
-- Run `pnpm --filter @churchflow/api budget:migrate-exchanges` before this migration: whatever it
-- has not moved over is deleted here together with its entries and notes.
DELETE FROM "budget_categories" WHERE "group" = 'CURRENCY_EXCHANGE';

ALTER TYPE "BudgetGroup" RENAME TO "BudgetGroup_old";

CREATE TYPE "BudgetGroup" AS ENUM (
  'INCOME',
  'FACILITY',
  'TABLES',
  'PASTORS',
  'DISCIPLESHIP',
  'EVANGELISM',
  'OTHER'
);

ALTER TABLE "budget_categories"
  ALTER COLUMN "group" TYPE "BudgetGroup" USING "group"::text::"BudgetGroup";

DROP TYPE "BudgetGroup_old";
