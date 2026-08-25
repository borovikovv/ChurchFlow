-- website_pages, website_sections і website_domains несли organization_id взагалі без
-- зовнішнього ключа: значення могло розійтися з організацією батька і ніхто б не дізнався.
-- Спершу вирівнюємо його по батьку (organization_id тут похідний, батько — джерело правди),
-- потім робимо звʼязок композитним, щоб розійтися вже не вийшло.

UPDATE "website_pages" wp
SET "organization_id" = ow."organization_id"
FROM "organization_websites" ow
WHERE ow."id" = wp."website_id"
  AND wp."organization_id" <> ow."organization_id";

-- Після сторінок, бо секції беруть організацію саме від них.
UPDATE "website_sections" ws
SET "organization_id" = wp."organization_id"
FROM "website_pages" wp
WHERE wp."id" = ws."page_id"
  AND ws."organization_id" <> wp."organization_id";

UPDATE "website_domains" wd
SET "organization_id" = ow."organization_id"
FROM "organization_websites" ow
WHERE ow."id" = wd."website_id"
  AND wd."organization_id" <> ow."organization_id";

CREATE UNIQUE INDEX "organization_websites_id_organization_id_key"
  ON "organization_websites"("id", "organization_id");

CREATE UNIQUE INDEX "website_pages_id_organization_id_key"
  ON "website_pages"("id", "organization_id");

ALTER TABLE "website_pages" DROP CONSTRAINT "website_pages_website_id_fkey";
ALTER TABLE "website_sections" DROP CONSTRAINT "website_sections_page_id_fkey";
ALTER TABLE "website_domains" DROP CONSTRAINT "website_domains_website_id_fkey";

ALTER TABLE "website_pages"
  ADD CONSTRAINT "website_pages_website_id_organization_id_fkey"
  FOREIGN KEY ("website_id", "organization_id") REFERENCES "organization_websites"("id", "organization_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "website_sections"
  ADD CONSTRAINT "website_sections_page_id_organization_id_fkey"
  FOREIGN KEY ("page_id", "organization_id") REFERENCES "website_pages"("id", "organization_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "website_domains"
  ADD CONSTRAINT "website_domains_website_id_organization_id_fkey"
  FOREIGN KEY ("website_id", "organization_id") REFERENCES "organization_websites"("id", "organization_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "website_pages_website_id_organization_id_idx"
  ON "website_pages"("website_id", "organization_id");

CREATE INDEX "website_sections_page_id_organization_id_idx"
  ON "website_sections"("page_id", "organization_id");

CREATE INDEX "website_domains_website_id_organization_id_idx"
  ON "website_domains"("website_id", "organization_id");
