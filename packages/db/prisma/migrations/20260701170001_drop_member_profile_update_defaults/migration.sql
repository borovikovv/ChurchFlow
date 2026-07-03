-- Prisma manages updated_at values for these models. The original generated
-- migration ran before the tables existed, so enforce the intended schema
-- immediately after their creation.
ALTER TABLE "membership_claims" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "organization_member_profiles" ALTER COLUMN "updated_at" DROP DEFAULT;
