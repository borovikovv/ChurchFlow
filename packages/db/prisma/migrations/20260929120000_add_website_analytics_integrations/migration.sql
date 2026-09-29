-- CreateEnum
CREATE TYPE "WebsiteAnalyticsProvider" AS ENUM ('GOOGLE_ANALYTICS');

-- CreateEnum
CREATE TYPE "WebsiteAnalyticsMode" AS ENUM ('OAUTH', 'MANUAL');

-- CreateEnum
CREATE TYPE "WebsiteAnalyticsStatus" AS ENUM ('CONNECTED', 'NEEDS_REAUTH');

-- CreateTable
-- One analytics connection per organization. The refresh token is stored encrypted and never
-- leaves the API; only the measurement id reaches the public website.
CREATE TABLE "website_analytics_integrations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" "WebsiteAnalyticsProvider" NOT NULL DEFAULT 'GOOGLE_ANALYTICS',
    "mode" "WebsiteAnalyticsMode" NOT NULL,
    "status" "WebsiteAnalyticsStatus" NOT NULL DEFAULT 'CONNECTED',
    "measurement_id" TEXT,
    "google_account_email" TEXT,
    "ga_account_id" TEXT,
    "property_id" TEXT,
    "property_display_name" TEXT,
    "stream_id" TEXT,
    "encrypted_refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_analytics_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_analytics_integrations_organization_id_key" ON "website_analytics_integrations"("organization_id");

-- AddForeignKey
ALTER TABLE "website_analytics_integrations" ADD CONSTRAINT "website_analytics_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
