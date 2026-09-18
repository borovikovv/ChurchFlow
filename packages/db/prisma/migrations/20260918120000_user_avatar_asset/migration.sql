-- A user's own avatar is not organization content, so media assets may now exist without one.
ALTER TABLE "media_assets" ALTER COLUMN "organization_id" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN "avatar_asset_id" UUID;

CREATE UNIQUE INDEX "users_avatar_asset_id_key" ON "users"("avatar_asset_id");

ALTER TABLE "users" ADD CONSTRAINT "users_avatar_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
