CREATE TABLE IF NOT EXISTS "telegram_history_coverage" (
	"covered_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"id" bigserial PRIMARY KEY NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_history_coverage_proofs" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"id" bigserial PRIMARY KEY NOT NULL,
	"proved_at" timestamp with time zone NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_history_coverage_chat_interval_idx" ON "telegram_history_coverage" USING btree ("telegram_chat_id","start_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_history_coverage_proofs_chat_interval_idx" ON "telegram_history_coverage_proofs" USING btree ("telegram_chat_id","start_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_history_coverage_proofs_chat_proved_idx" ON "telegram_history_coverage_proofs" USING btree ("telegram_chat_id","proved_at");
--> statement-breakpoint
DO $$
BEGIN
	IF to_regclass('public.history_coverage') IS NOT NULL THEN
		INSERT INTO "telegram_history_coverage" (
			"covered_at",
			"end_at",
			"start_at",
			"telegram_chat_id",
			"updated_at"
		)
		SELECT
			"updated_at",
			"end_at",
			"start_at",
			"telegram_chat_id",
			"updated_at"
		FROM "history_coverage";

		INSERT INTO "telegram_history_coverage_proofs" (
			"end_at",
			"proved_at",
			"start_at",
			"telegram_chat_id",
			"updated_at"
		)
		SELECT
			"end_at",
			"updated_at",
			"start_at",
			"telegram_chat_id",
			"updated_at"
		FROM "history_coverage";
	END IF;
END $$;
