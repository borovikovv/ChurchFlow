CREATE TABLE "scheduled_job_locks" (
  "name" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "locked_at" TIMESTAMP(3) NOT NULL,
  "locked_until" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "scheduled_job_locks_pkey" PRIMARY KEY ("name")
);

CREATE INDEX "scheduled_job_locks_locked_until_idx"
  ON "scheduled_job_locks"("locked_until");
