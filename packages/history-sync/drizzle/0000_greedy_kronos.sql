CREATE TABLE IF NOT EXISTS "history_backfill_jobs" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cursor" jsonb,
	"end_at" timestamp with time zone NOT NULL,
	"id" bigserial PRIMARY KEY NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "history_coverage" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"id" bigserial PRIMARY KEY NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "history_targets" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"range" jsonb NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"template_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "history_templates" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"match" jsonb NOT NULL,
	"range" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "history_backfill_jobs_status_interval_idx" ON "history_backfill_jobs" USING btree ("status","end_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "history_backfill_jobs_chat_interval_unique_idx" ON "history_backfill_jobs" USING btree ("telegram_chat_id","start_at","end_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "history_coverage_chat_interval_idx" ON "history_coverage" USING btree ("telegram_chat_id","start_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "history_targets_chat_idx" ON "history_targets" USING btree ("telegram_chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "history_targets_chat_range_unique_idx" ON "history_targets" USING btree ("telegram_chat_id","range");