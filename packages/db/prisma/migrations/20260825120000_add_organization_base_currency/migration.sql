-- CreateEnum
CREATE TYPE "BudgetCurrency" AS ENUM ('UAH', 'USD', 'EUR');

-- AlterTable
ALTER TABLE "organizations"
  ADD COLUMN "base_currency" "BudgetCurrency" NOT NULL DEFAULT 'UAH';
