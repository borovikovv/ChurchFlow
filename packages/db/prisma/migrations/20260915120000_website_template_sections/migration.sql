-- The first public website template adds a live-stream block, a giving block and a
-- dedicated footer; sections also gain a hidden flag so a template can add its missing
-- sections without publishing them until an administrator fills them in.
ALTER TYPE "WebsiteSectionType" ADD VALUE IF NOT EXISTS 'live';
ALTER TYPE "WebsiteSectionType" ADD VALUE IF NOT EXISTS 'giving';
ALTER TYPE "WebsiteSectionType" ADD VALUE IF NOT EXISTS 'footer';

ALTER TABLE "website_sections" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
