DROP INDEX IF EXISTS "audit_logs_organization_id_created_at_idx";

CREATE INDEX "audit_logs_organization_id_created_at_id_idx" ON "audit_logs"("organization_id", "created_at", "id");
