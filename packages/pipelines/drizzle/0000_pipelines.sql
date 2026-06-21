CREATE TABLE IF NOT EXISTS "pipelines_definitions" (
  "name" text PRIMARY KEY,
  "yaml" text NOT NULL,
  "document" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pipelines_runs" (
  "run_id" text PRIMARY KEY,
  "pipeline_name" text NOT NULL,
  "definition_snapshot" jsonb NOT NULL,
  "idempotency_key" text,
  "trigger_name" text,
  "status" text NOT NULL,
  "failure_code" text,
  "failure_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "pipelines_runs_name_idx"
  ON "pipelines_runs" ("pipeline_name", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "pipelines_runs_idempotency_idx"
  ON "pipelines_runs" ("idempotency_key");

CREATE TABLE IF NOT EXISTS "pipelines_node_runs" (
  "run_id" text NOT NULL,
  "node_id" text NOT NULL,
  "action_id" text NOT NULL,
  "status" text NOT NULL,
  "input_dataset" jsonb NOT NULL,
  "output_dataset" jsonb,
  "provider_run_id" text,
  "failure_code" text,
  "failure_message" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pipelines_node_runs_pk" PRIMARY KEY ("run_id", "node_id")
);

CREATE INDEX IF NOT EXISTS "pipelines_node_runs_status_idx"
  ON "pipelines_node_runs" ("status");

CREATE TABLE IF NOT EXISTS "pipelines_trigger_bindings" (
  "key" text PRIMARY KEY,
  "pipeline_name" text NOT NULL,
  "trigger_name" text NOT NULL,
  "registration_key" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "pipelines_trigger_bindings_name_idx"
  ON "pipelines_trigger_bindings" ("pipeline_name");
