CREATE TABLE "telegram_history_coverage" (
  "covered_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "id" bigserial PRIMARY KEY NOT NULL,
  "start_at" timestamp with time zone NOT NULL,
  "telegram_chat_id" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "telegram_history_coverage_chat_interval_idx" ON "telegram_history_coverage" ("telegram_chat_id", "start_at");
