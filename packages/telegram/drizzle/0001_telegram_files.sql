CREATE TABLE IF NOT EXISTS "telegram_files" (
	"attempts" integer DEFAULT 0 NOT NULL,
	"byte_size" integer,
	"downloaded_byte_size" integer,
	"download_error" text,
	"duration_seconds" integer,
	"file_name" text,
	"height" integer,
	"last_requested_at" timestamp with time zone,
	"media_kind" text NOT NULL,
	"mime_type" text,
	"owner_id" text NOT NULL,
	"owner_model" text NOT NULL,
	"relative_path" text,
	"render_kind" text NOT NULL,
	"sha256" text,
	"slot_key" text NOT NULL,
	"source" jsonb NOT NULL,
	"source_fingerprint" text NOT NULL,
	"status" text NOT NULL,
	"tdlib_file_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"width" integer,
	CONSTRAINT "telegram_files_owner_model_owner_id_slot_key_pk" PRIMARY KEY("owner_model","owner_id","slot_key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_files_owner_idx" ON "telegram_files" USING btree ("owner_model","owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_files_status_idx" ON "telegram_files" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_files_tdlib_file_id_idx" ON "telegram_files" USING btree ("tdlib_file_id");
