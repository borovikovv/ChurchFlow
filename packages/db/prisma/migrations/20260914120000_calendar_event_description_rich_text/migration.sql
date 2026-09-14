-- Calendar event descriptions become a sanitized HTML subset (see RICH_TEXT_ALLOWED_TAGS).
-- Existing rows hold plain text: escape it and keep line breaks so it re-enters the editor,
-- the web renderer and the Telegram converter as the text it was, not as markup.
UPDATE "calendar_events"
SET "description" = NULL
WHERE "description" IS NOT NULL
  AND btrim("description") = '';

UPDATE "calendar_events"
SET "description" = '<p>'
  || replace(
       replace(
         replace(
           replace(
             replace(btrim("description"), '&', '&amp;'),
             '<', '&lt;'),
           '>', '&gt;'),
         E'\r\n', '<br>'),
       E'\n', '<br>')
  || '</p>'
WHERE "description" IS NOT NULL
  AND "description" NOT LIKE '<p>%'
  AND "description" NOT LIKE '<ul>%'
  AND "description" NOT LIKE '<ol>%';
