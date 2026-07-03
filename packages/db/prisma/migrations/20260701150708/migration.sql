-- These tables are introduced by the later
-- 20260701170000_manual_membership_claims migration. Keep this migration
-- compatible with databases where an earlier development version had already
-- created them, while allowing a clean migration replay from an empty database.
ALTER TABLE IF EXISTS "membership_claims" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE IF EXISTS "organization_member_profiles" ALTER COLUMN "updated_at" DROP DEFAULT;
