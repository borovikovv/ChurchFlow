DROP INDEX IF EXISTS "org_inv_target_status_key";

CREATE UNIQUE INDEX "org_inv_pending_target_key"
  ON "organization_invitations"("organization_id", "target_provider", "target_provider_account_id")
  WHERE "status" = 'PENDING'
    AND "accepted_at" IS NULL
    AND "revoked_at" IS NULL
    AND "target_provider" IS NOT NULL
    AND "target_provider_account_id" IS NOT NULL;

WITH ranked_pending_requests AS (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "requested_by_user_id"
           ORDER BY "created_at" DESC, "id" DESC
         ) AS position
  FROM "organization_requests"
  WHERE "status" = 'PENDING'
    AND "requested_by_user_id" IS NOT NULL
)
UPDATE "organization_requests" AS request
SET "status" = 'EXPIRED',
    "updated_at" = CURRENT_TIMESTAMP
FROM ranked_pending_requests
WHERE request."id" = ranked_pending_requests."id"
  AND ranked_pending_requests.position > 1;

CREATE UNIQUE INDEX "organization_requests_one_pending_per_requester_key"
  ON "organization_requests"("requested_by_user_id")
  WHERE "status" = 'PENDING'
    AND "requested_by_user_id" IS NOT NULL;
