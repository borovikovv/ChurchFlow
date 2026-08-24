-- Індекси під зовнішні ключі, які їх не мали.
-- Без них кожен ON DELETE CASCADE / SET NULL сканує дочірню таблицю цілком.

CREATE INDEX "organization_invitations_invited_by_id_idx"
  ON "organization_invitations"("invited_by_id");

CREATE INDEX "organization_requests_reviewed_by_user_id_idx"
  ON "organization_requests"("reviewed_by_user_id");

CREATE INDEX "organization_requests_created_organization_id_idx"
  ON "organization_requests"("created_organization_id");

CREATE INDEX "membership_claims_reviewed_by_user_id_idx"
  ON "membership_claims"("reviewed_by_user_id");

CREATE INDEX "membership_claims_created_by_user_id_idx"
  ON "membership_claims"("created_by_user_id");

CREATE INDEX "organization_member_relationships_from_membership_id_idx"
  ON "organization_member_relationships"("from_membership_id");

CREATE INDEX "organization_member_relationships_to_membership_id_idx"
  ON "organization_member_relationships"("to_membership_id");

CREATE INDEX "calendar_events_created_by_user_id_idx"
  ON "calendar_events"("created_by_user_id");

CREATE INDEX "preacher_queue_entries_membership_id_idx"
  ON "preacher_queue_entries"("membership_id");

CREATE INDEX "notifications_recipient_membership_id_idx"
  ON "notifications"("recipient_membership_id");

CREATE INDEX "prayer_requests_author_user_id_idx"
  ON "prayer_requests"("author_user_id");

CREATE INDEX "prayer_requests_archived_by_user_id_idx"
  ON "prayer_requests"("archived_by_user_id");

-- organization_websites.logo_asset_id був UUID без зовнішнього ключа:
-- посилання на видалений медіафайл лишалося висіти. Спершу гасимо биті посилання.

UPDATE "organization_websites" ow
SET "logo_asset_id" = NULL
WHERE ow."logo_asset_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "media_assets" ma WHERE ma."id" = ow."logo_asset_id"
  );

ALTER TABLE "organization_websites"
  ADD CONSTRAINT "organization_websites_logo_asset_id_fkey"
  FOREIGN KEY ("logo_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "organization_websites_logo_asset_id_idx"
  ON "organization_websites"("logo_asset_id");

-- Узгодженість status і відповідного таймстемпа.
-- Тільки односторонні імплікації (status = X => таймстемп заповнений):
-- зворотні не тримаються, бо ARCHIVE/SUSPEND не гасять раніше проставлені мітки.
-- NOT VALID: нові й змінені рядки перевіряються одразу, історичні лишаються як є.

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_status_timestamps_check" CHECK (
    ("status" <> 'ARCHIVED' OR "archived_at" IS NOT NULL)
    AND ("status" <> 'SUSPENDED' OR "suspended_at" IS NOT NULL)
    AND ("status" <> 'DELETED' OR "deleted_at" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "organization_members"
  ADD CONSTRAINT "organization_members_status_timestamps_check" CHECK (
    ("status" <> 'ARCHIVED' OR "archived_at" IS NOT NULL)
    AND ("status" <> 'REMOVED' OR "removed_at" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "membership_claims"
  ADD CONSTRAINT "membership_claims_status_timestamps_check" CHECK (
    ("status" <> 'REQUESTED' OR "requested_at" IS NOT NULL)
    AND ("status" <> 'APPROVED' OR "approved_at" IS NOT NULL)
    AND ("status" <> 'REJECTED' OR "rejected_at" IS NOT NULL)
    AND ("status" <> 'REVOKED' OR "revoked_at" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "organization_invitations"
  ADD CONSTRAINT "organization_invitations_status_timestamps_check" CHECK (
    ("status" <> 'ACCEPTED' OR "accepted_at" IS NOT NULL)
    AND ("status" <> 'REVOKED' OR "revoked_at" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "organization_requests"
  ADD CONSTRAINT "organization_requests_status_timestamps_check" CHECK (
    ("status" <> 'APPROVED' OR "approved_at" IS NOT NULL)
    AND ("status" <> 'REJECTED' OR "rejected_at" IS NOT NULL)
  ) NOT VALID;

-- feature_flags: у складеному unique були nullable-колонки, а в Postgres NULL <> NULL,
-- тому для GLOBAL-флагів унікальність не діяла взагалі — один key міг лежати багато разів.
-- Замінюємо на часткові унікальні індекси, по одному на scope.

DROP INDEX "feature_flags_key_scope_organization_id_user_id_key";

ALTER TABLE "feature_flags"
  ADD CONSTRAINT "feature_flags_scope_target_check" CHECK (
    ("scope" = 'GLOBAL' AND "organization_id" IS NULL AND "user_id" IS NULL)
    OR ("scope" = 'ORGANIZATION' AND "organization_id" IS NOT NULL AND "user_id" IS NULL)
    OR ("scope" = 'USER' AND "user_id" IS NOT NULL AND "organization_id" IS NULL)
  ) NOT VALID;

CREATE UNIQUE INDEX "feature_flags_global_key"
  ON "feature_flags"("key")
  WHERE "scope" = 'GLOBAL';

CREATE UNIQUE INDEX "feature_flags_organization_key"
  ON "feature_flags"("key", "organization_id")
  WHERE "scope" = 'ORGANIZATION';

CREATE UNIQUE INDEX "feature_flags_user_key"
  ON "feature_flags"("key", "user_id")
  WHERE "scope" = 'USER';
