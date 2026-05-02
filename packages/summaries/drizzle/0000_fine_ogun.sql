CREATE TABLE "summaries_invalidations" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_id" text,
	"invalidated_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"telegram_chat_id" text PRIMARY KEY NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summaries_results" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"summary" text NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "summaries_results_telegram_chat_id_unique" UNIQUE("telegram_chat_id")
);
--> statement-breakpoint
CREATE TABLE "summaries_runs" (
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error" jsonb,
	"failed_at" timestamp with time zone,
	"id" text PRIMARY KEY NOT NULL,
	"reason" text,
	"requested_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"status" text NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summaries_source_refs" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" bigserial PRIMARY KEY NOT NULL,
	"message_date" timestamp with time zone,
	"result_id" bigint NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"telegram_message_id" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "summaries_invalidations_reason_idx" ON "summaries_invalidations" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "summaries_results_chat_idx" ON "summaries_results" USING btree ("telegram_chat_id");--> statement-breakpoint
CREATE INDEX "summaries_runs_chat_status_idx" ON "summaries_runs" USING btree ("telegram_chat_id","status");--> statement-breakpoint
CREATE INDEX "summaries_source_refs_result_idx" ON "summaries_source_refs" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "summaries_source_refs_chat_message_idx" ON "summaries_source_refs" USING btree ("telegram_chat_id","telegram_message_id");