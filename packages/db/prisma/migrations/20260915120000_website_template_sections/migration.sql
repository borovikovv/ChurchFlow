ALTER TYPE "WebsiteSectionType" ADD VALUE IF NOT EXISTS 'live';
ALTER TYPE "WebsiteSectionType" ADD VALUE IF NOT EXISTS 'giving';
ALTER TYPE "WebsiteSectionType" ADD VALUE IF NOT EXISTS 'footer';

ALTER TABLE "website_sections" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
