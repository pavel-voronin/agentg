CREATE TABLE IF NOT EXISTS "llm_runner_runs" (
  "run_id" text PRIMARY KEY,
  "pipeline_run_id" text NOT NULL,
  "pipeline_node_id" text NOT NULL,
  "profile" text NOT NULL,
  "prompt" text NOT NULL,
  "input_dataset" jsonb NOT NULL,
  "input_metadata" jsonb NOT NULL,
  "output_metadata" jsonb,
  "output_dataset" jsonb,
  "status" text NOT NULL,
  "failure_code" text,
  "failure_message" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "llm_runner_runs_pipeline_node_idx"
  ON "llm_runner_runs" ("pipeline_run_id", "pipeline_node_id");

CREATE INDEX IF NOT EXISTS "llm_runner_runs_status_idx"
  ON "llm_runner_runs" ("status", "updated_at");
