-- DropIndex
DROP INDEX "budget_entries_month_id_category_id_key";

-- AlterTable
ALTER TABLE "budget_entries" ADD COLUMN "row_index" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "budget_entries_month_id_category_id_row_index_key"
  ON "budget_entries"("month_id", "category_id", "row_index");

-- CreateIndex
CREATE INDEX "budget_entries_month_id_row_index_idx"
  ON "budget_entries"("month_id", "row_index");
