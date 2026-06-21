DROP INDEX IF EXISTS "pipelines_runs_idempotency_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "pipelines_runs_idempotency_idx"
  ON "pipelines_runs" ("idempotency_key");
