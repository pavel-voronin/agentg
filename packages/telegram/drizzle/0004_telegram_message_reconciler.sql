ALTER TABLE "telegram_history_coverage" ADD COLUMN "owner_key" text;
--> statement-breakpoint
ALTER TABLE "telegram_history_coverage" ADD COLUMN "owner_kind" text;
--> statement-breakpoint
UPDATE "telegram_history_coverage"
SET
  "owner_kind" = 'chat',
  "owner_key" = 'chat:' || "telegram_chat_id"
WHERE "owner_kind" IS NULL OR "owner_key" IS NULL;
--> statement-breakpoint
ALTER TABLE "telegram_history_coverage" ALTER COLUMN "owner_key" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "telegram_history_coverage" ALTER COLUMN "owner_kind" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "telegram_history_coverage" ALTER COLUMN "telegram_chat_id" DROP NOT NULL;
--> statement-breakpoint
CREATE INDEX "telegram_history_coverage_owner_interval_idx" ON "telegram_history_coverage" ("owner_key", "start_at");
--> statement-breakpoint
CREATE TABLE "telegram_history_reconciler_jobs" (
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_failure_reason" text,
  "locked_at" timestamp with time zone,
  "next_run_at" timestamp with time zone NOT NULL,
  "owner" jsonb NOT NULL,
  "owner_key" text NOT NULL,
  "owner_kind" text NOT NULL,
  "request_id" text PRIMARY KEY NOT NULL,
  "selector" jsonb NOT NULL,
  "selector_kind" text NOT NULL,
  "status" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "telegram_history_reconciler_jobs_status_next_idx" ON "telegram_history_reconciler_jobs" ("status", "next_run_at");
--> statement-breakpoint
CREATE INDEX "telegram_history_reconciler_jobs_owner_idx" ON "telegram_history_reconciler_jobs" ("owner_key");
