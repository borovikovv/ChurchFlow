CREATE TABLE "budget_opening_balances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "since_year" INTEGER NOT NULL,
    "amount_uah" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount_usd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount_eur" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_opening_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "budget_opening_balances_organization_id_since_year_key" ON "budget_opening_balances"("organization_id", "since_year");

ALTER TABLE "budget_opening_balances" ADD CONSTRAINT "budget_opening_balances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
