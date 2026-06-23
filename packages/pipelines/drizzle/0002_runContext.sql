ALTER TABLE "pipelines_runs"
  ADD COLUMN IF NOT EXISTS "context" jsonb NOT NULL DEFAULT '{}'::jsonb;
