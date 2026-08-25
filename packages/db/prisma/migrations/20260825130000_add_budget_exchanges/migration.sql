-- CreateTable
CREATE TABLE "budget_exchanges" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "month_id" UUID NOT NULL,
    "occurred_on" DATE NOT NULL,
    "from_currency" "BudgetCurrency" NOT NULL,
    "from_amount" DECIMAL(12,2) NOT NULL,
    "to_currency" "BudgetCurrency" NOT NULL,
    "to_amount" DECIMAL(12,2) NOT NULL,
    "deal_rate" DECIMAL(18,8) NOT NULL,
    "official_rate" DECIMAL(18,8),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_exchanges_month_id_idx" ON "budget_exchanges"("month_id");

-- CreateIndex
CREATE INDEX "budget_exchanges_organization_id_occurred_on_idx" ON "budget_exchanges"("organization_id", "occurred_on");

-- AddForeignKey
ALTER TABLE "budget_exchanges" ADD CONSTRAINT "budget_exchanges_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_exchanges" ADD CONSTRAINT "budget_exchanges_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "budget_months"("id") ON DELETE CASCADE ON UPDATE CASCADE;
