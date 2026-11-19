-- Service roles draw their people from groups the church picks, instead of guessing from group
-- icons. A link points at (group, organization), so deleting a group removes its links.
CREATE TABLE "organization_service_role_groups" (
    "organization_id" UUID NOT NULL,
    "role" "CalendarServiceRole" NOT NULL,
    "group_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_service_role_groups_pkey" PRIMARY KEY ("organization_id", "role", "group_id")
);

CREATE INDEX "organization_service_role_groups_organization_id_group_id_idx" ON "organization_service_role_groups"("organization_id", "group_id");

CREATE INDEX "organization_service_role_groups_group_id_idx" ON "organization_service_role_groups"("group_id");

ALTER TABLE "organization_service_role_groups" ADD CONSTRAINT "organization_service_role_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_service_role_groups" ADD CONSTRAINT "organization_service_role_groups_group_id_organization_id_fkey" FOREIGN KEY ("group_id", "organization_id") REFERENCES "organization_groups"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the links from the icons existing groups already carry, so the service form suggests the
-- same people as before the release. Must match ORGANIZATION_GROUP_ICON_SERVICE_ROLES in
-- @churchflow/shared. The host role is left unlinked: the old heuristics disagreed on it.
-- Groups that share an icon are ordered by name.
WITH "icon_role" ("icon", "role") AS (
    VALUES
        ('preaching', 'PREACHER'),
        ('worship', 'WORSHIP_LEAD'),
        ('deacons', 'COMMUNION_LEAD'),
        ('sound', 'SOUND_ENGINEER'),
        ('media', 'LIVESTREAM_LEAD')
)
INSERT INTO "organization_service_role_groups" ("organization_id", "role", "group_id", "position")
SELECT
    g."organization_id",
    ir."role"::"CalendarServiceRole",
    g."id",
    (ROW_NUMBER() OVER (PARTITION BY g."organization_id", ir."role" ORDER BY g."name", g."id") - 1)::INTEGER
FROM "organization_groups" g
JOIN "icon_role" ir ON ir."icon" = g."icon"::text
ON CONFLICT DO NOTHING;
