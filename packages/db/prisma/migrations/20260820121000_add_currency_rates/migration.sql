CREATE TABLE "currency_rates" (
    "date" DATE NOT NULL,
    "usd_to_uah" DECIMAL(12,4) NOT NULL,
    "eur_to_uah" DECIMAL(12,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_rates_pkey" PRIMARY KEY ("date")
);
