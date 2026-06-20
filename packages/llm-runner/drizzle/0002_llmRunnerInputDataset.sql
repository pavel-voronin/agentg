ALTER TABLE "llm_runner_runs"
  ADD COLUMN IF NOT EXISTS "input_dataset" jsonb;

UPDATE "llm_runner_runs"
SET
  "failure_code" = coalesce("failure_code", 'missing_input_dataset'),
  "failure_message" = coalesce(
    "failure_message",
    'LLM run input dataset was not stored before recovery support was added'
  ),
  "status" = 'failed',
  "updated_at" = now()
WHERE "input_dataset" IS NULL
  AND "status" IN ('accepted', 'processing');

UPDATE "llm_runner_runs"
SET "input_dataset" = coalesce("input_dataset", '{"rows":[]}'::jsonb)
WHERE "input_dataset" IS NULL;

ALTER TABLE "llm_runner_runs"
  ALTER COLUMN "input_dataset" SET NOT NULL;
