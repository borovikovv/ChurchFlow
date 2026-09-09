-- Groups replace the hardcoded MemberMinistry enum with per-organization rows that carry
-- a name, description, icon, colour and leaders. The old enum, its table and the rows in it
-- are deliberately left in place here: this migration only copies them forward, so a bad
-- deploy is a revert rather than a restore. A follow-up migration drops them.

-- The ministry rows carry their own organization_id with no composite key behind it, so a drifted
-- row would only surface as a raw foreign key violation once the copy below runs. Stop here instead
-- and name the rows.
DO $$
DECLARE
  mismatched bigint;
BEGIN
  SELECT count(*) INTO mismatched
  FROM "organization_member_ministries" omm
  JOIN "organization_members" om ON om."id" = omm."membership_id"
  WHERE om."organization_id" <> omm."organization_id";

  IF mismatched > 0 THEN
    RAISE EXCEPTION
      'organization_member_ministries: % rows point at a membership of another organization; resolve them before applying this migration',
      mismatched;
  END IF;
END $$;

CREATE TYPE "OrganizationGroupIcon" AS ENUM ('preaching', 'worship', 'choir', 'prayer', 'teaching', 'children', 'youth', 'women', 'men', 'family', 'missions', 'evangelism', 'media', 'sound', 'hospitality', 'ushers', 'charity', 'smallGroup', 'deacons', 'leadership', 'finance', 'transport');

CREATE TYPE "OrganizationGroupMemberRole" AS ENUM ('LEADER', 'MEMBER');

CREATE TABLE "organization_groups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" CITEXT NOT NULL,
    "description" TEXT,
    "icon" "OrganizationGroupIcon" NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_groups_organization_id_name_key" ON "organization_groups"("organization_id", "name");

CREATE UNIQUE INDEX "organization_groups_id_organization_id_key" ON "organization_groups"("id", "organization_id");

CREATE INDEX "organization_groups_organization_id_idx" ON "organization_groups"("organization_id");

CREATE INDEX "organization_groups_created_by_user_id_idx" ON "organization_groups"("created_by_user_id");

ALTER TABLE "organization_groups" ADD CONSTRAINT "organization_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_groups" ADD CONSTRAINT "organization_groups_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Membership rows point at (group, organization) and (membership, organization) rather than at
-- bare ids, so a group of one organization cannot be filled with members of another.
CREATE UNIQUE INDEX "organization_members_id_organization_id_key" ON "organization_members"("id", "organization_id");

CREATE TABLE "organization_group_members" (
    "organization_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "role" "OrganizationGroupMemberRole" NOT NULL DEFAULT 'MEMBER',
    "responsibility" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_group_members_pkey" PRIMARY KEY ("group_id", "membership_id")
);

CREATE INDEX "organization_group_members_organization_id_group_id_idx" ON "organization_group_members"("organization_id", "group_id");

CREATE INDEX "organization_group_members_organization_id_membership_id_idx" ON "organization_group_members"("organization_id", "membership_id");

CREATE INDEX "organization_group_members_membership_id_idx" ON "organization_group_members"("membership_id");

ALTER TABLE "organization_group_members" ADD CONSTRAINT "organization_group_members_group_id_organization_id_fkey" FOREIGN KEY ("group_id", "organization_id") REFERENCES "organization_groups"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_group_members" ADD CONSTRAINT "organization_group_members_membership_id_organization_id_fkey" FOREIGN KEY ("membership_id", "organization_id") REFERENCES "organization_members"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry the existing ministry assignments over. Only ministries an organization actually uses
-- become groups, so nobody starts with eleven empty ones. Everyone lands as MEMBER; the enum
-- had no notion of a leader.
WITH "ministry_group" ("ministry", "name", "icon", "color") AS (
  VALUES
    ('PREACHING',  'Preaching',    'preaching',  '#7C3AED'),
    ('WORSHIP',    'Worship',      'worship',    '#2563EB'),
    ('DEACON',     'Deacons',      'deacons',    '#0D9488'),
    ('MINISTER',   'Ministers',    'leadership', '#B45309'),
    ('TEACHER',    'Teachers',     'teaching',   '#4F46E5'),
    ('MISSIONARY', 'Missionaries', 'missions',   '#059669'),
    ('EVANGELIST', 'Evangelists',  'evangelism', '#DC2626'),
    ('CHAPLAIN',   'Chaplains',    'prayer',     '#DB2777'),
    ('CHILDREN',   'Children',     'children',   '#EA580C'),
    ('YOUTH',      'Youth',        'youth',      '#CA8A04'),
    ('MEDIA',      'Media',        'media',      '#475569')
)
INSERT INTO "organization_groups" ("id", "organization_id", "name", "icon", "color", "is_system", "created_at", "updated_at")
SELECT gen_random_uuid(), used."organization_id", mg."name", mg."icon"::"OrganizationGroupIcon", mg."color", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "organization_id", "ministry" FROM "organization_member_ministries") used
JOIN "ministry_group" mg ON mg."ministry" = used."ministry"::text
ON CONFLICT ("organization_id", "name") DO NOTHING;

WITH "ministry_group" ("ministry", "name") AS (
  VALUES
    ('PREACHING',  'Preaching'),
    ('WORSHIP',    'Worship'),
    ('DEACON',     'Deacons'),
    ('MINISTER',   'Ministers'),
    ('TEACHER',    'Teachers'),
    ('MISSIONARY', 'Missionaries'),
    ('EVANGELIST', 'Evangelists'),
    ('CHAPLAIN',   'Chaplains'),
    ('CHILDREN',   'Children'),
    ('YOUTH',      'Youth'),
    ('MEDIA',      'Media')
)
INSERT INTO "organization_group_members" ("organization_id", "group_id", "membership_id", "role", "created_at")
SELECT omm."organization_id", g."id", omm."membership_id", 'MEMBER', omm."created_at"
FROM "organization_member_ministries" omm
JOIN "ministry_group" mg ON mg."ministry" = omm."ministry"::text
JOIN "organization_groups" g ON g."organization_id" = omm."organization_id" AND g."name" = mg."name"
ON CONFLICT ("group_id", "membership_id") DO NOTHING;
