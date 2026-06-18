CREATE TABLE IF NOT EXISTS "llm_runner_runs" (
  "run_id" text PRIMARY KEY,
  "artifact_key" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deduplication_key" text,
  "failure_code" text,
  "failure_message" text,
  "payload" jsonb NOT NULL,
  "profile" text NOT NULL,
  "source_snapshot" jsonb,
  "status" text NOT NULL,
  "trigger" jsonb,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "llm_runner_runs_deduplication_key_idx"
  ON "llm_runner_runs" ("deduplication_key");

CREATE INDEX IF NOT EXISTS "llm_runner_runs_status_idx"
  ON "llm_runner_runs" ("status", "updated_at");

CREATE TABLE IF NOT EXISTS "llm_runner_artifacts" (
  "artifact_id" text PRIMARY KEY,
  "artifact_key" text NOT NULL,
  "body" text NOT NULL,
  "content_refs" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "payload" jsonb,
  "profile" text NOT NULL,
  "run_id" text NOT NULL,
  "source_ref_id" text NOT NULL,
  "source_ref_model" text NOT NULL,
  "source_refs" jsonb NOT NULL,
  "status" text NOT NULL,
  "title" text,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "llm_runner_artifacts_current_idx"
  ON "llm_runner_artifacts" ("artifact_key", "source_ref_model", "source_ref_id");

CREATE INDEX IF NOT EXISTS "llm_runner_artifacts_run_idx"
  ON "llm_runner_artifacts" ("run_id");
