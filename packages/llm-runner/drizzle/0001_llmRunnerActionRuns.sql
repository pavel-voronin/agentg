ALTER TABLE "llm_runner_runs"
  ADD COLUMN IF NOT EXISTS "pipeline_run_id" text,
  ADD COLUMN IF NOT EXISTS "pipeline_node_id" text,
  ADD COLUMN IF NOT EXISTS "prompt" text,
  ADD COLUMN IF NOT EXISTS "input_metadata" jsonb,
  ADD COLUMN IF NOT EXISTS "output_metadata" jsonb,
  ADD COLUMN IF NOT EXISTS "output_dataset" jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'llm_runner_runs'
      AND column_name = 'artifact_key'
  ) THEN
    ALTER TABLE "llm_runner_runs" ALTER COLUMN "artifact_key" DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'llm_runner_runs'
      AND column_name = 'payload'
  ) THEN
    ALTER TABLE "llm_runner_runs" ALTER COLUMN "payload" DROP NOT NULL;
  END IF;
END $$;

UPDATE "llm_runner_runs"
SET
  "pipeline_run_id" = coalesce("pipeline_run_id", "run_id"),
  "pipeline_node_id" = coalesce("pipeline_node_id", 'unknown'),
  "prompt" = coalesce("prompt", ''),
  "input_metadata" = coalesce("input_metadata", '{}'::jsonb)
WHERE "pipeline_run_id" IS NULL
  OR "pipeline_node_id" IS NULL
  OR "prompt" IS NULL
  OR "input_metadata" IS NULL;

ALTER TABLE "llm_runner_runs"
  ALTER COLUMN "pipeline_run_id" SET NOT NULL,
  ALTER COLUMN "pipeline_node_id" SET NOT NULL,
  ALTER COLUMN "prompt" SET NOT NULL,
  ALTER COLUMN "input_metadata" SET NOT NULL;

DROP TABLE IF EXISTS "llm_runner_artifacts";

CREATE INDEX IF NOT EXISTS "llm_runner_runs_pipeline_node_idx"
  ON "llm_runner_runs" ("pipeline_run_id", "pipeline_node_id");
