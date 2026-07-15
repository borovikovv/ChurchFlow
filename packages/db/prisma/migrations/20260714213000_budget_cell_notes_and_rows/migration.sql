-- CreateEnum
CREATE TYPE "BudgetEntryField" AS ENUM ('AMOUNT_UAH', 'AMOUNT_USD', 'AMOUNT_EUR');

-- AlterTable
ALTER TABLE "budget_months" ADD COLUMN "row_count" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "budget_entry_notes" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "field" "BudgetEntryField" NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_entry_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budget_entry_notes_entry_id_field_key" ON "budget_entry_notes"("entry_id", "field");

-- CreateIndex
CREATE INDEX "budget_entry_notes_entry_id_idx" ON "budget_entry_notes"("entry_id");

-- AddForeignKey
ALTER TABLE "budget_entry_notes" ADD CONSTRAINT "budget_entry_notes_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "budget_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
