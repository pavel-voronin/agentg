CREATE TABLE IF NOT EXISTS "telegram_file_assets" (
	"asset_key" text PRIMARY KEY NOT NULL,
	"byte_size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"downloaded_byte_size" integer,
	"download_error" text,
	"latest_remote_id" text,
	"latest_tdlib_file_id" integer,
	"provider" text NOT NULL,
	"relative_path" text,
	"remote_unique_id" text,
	"sha256" text,
	"status" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_file_download_jobs" (
	"asset_key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telegram_files" ADD COLUMN IF NOT EXISTS "asset_key" text;
--> statement-breakpoint
UPDATE "telegram_files"
SET "byte_size" = NULL
WHERE "byte_size" = 0;
--> statement-breakpoint
UPDATE "telegram_files"
SET "asset_key" = CASE
	WHEN "source"->>'remoteUniqueId' IS NOT NULL AND length("source"->>'remoteUniqueId') > 0
		THEN 'telegram:' || ("source"->>'remoteUniqueId')
	ELSE 'source:' || "source_fingerprint"
END
WHERE "asset_key" IS NULL;
--> statement-breakpoint
ALTER TABLE "telegram_files" ALTER COLUMN "asset_key" SET NOT NULL;
--> statement-breakpoint
INSERT INTO "telegram_file_assets" (
	"asset_key",
	"byte_size",
	"downloaded_byte_size",
	"download_error",
	"latest_remote_id",
	"latest_tdlib_file_id",
	"provider",
	"relative_path",
	"remote_unique_id",
	"sha256",
	"status",
	"updated_at"
)
SELECT
	"asset_key",
	max("byte_size"),
	max("downloaded_byte_size"),
	(array_agg("download_error" ORDER BY ("status" = 'failed') DESC, "updated_at" DESC) FILTER (WHERE "download_error" IS NOT NULL))[1],
	(array_agg("source"->>'remoteId' ORDER BY "updated_at" DESC) FILTER (WHERE "source"->>'remoteId' IS NOT NULL))[1],
	(array_agg("tdlib_file_id" ORDER BY "updated_at" DESC) FILTER (WHERE "tdlib_file_id" IS NOT NULL))[1],
	'telegram',
	(array_agg("relative_path" ORDER BY ("status" = 'ready') DESC, "updated_at" DESC) FILTER (WHERE "relative_path" IS NOT NULL))[1],
	(array_agg("source"->>'remoteUniqueId' ORDER BY "updated_at" DESC) FILTER (WHERE "source"->>'remoteUniqueId' IS NOT NULL))[1],
	(array_agg("sha256" ORDER BY ("status" = 'ready') DESC, "updated_at" DESC) FILTER (WHERE "sha256" IS NOT NULL))[1],
	CASE
		WHEN bool_or("status" = 'ready') THEN 'ready'
		WHEN bool_or("status" = 'failed') THEN 'failed'
		ELSE 'known'
	END,
	max("updated_at")
FROM "telegram_files"
GROUP BY "asset_key"
ON CONFLICT ("asset_key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "telegram_file_download_jobs" (
	"asset_key",
	"attempts",
	"claimed_at",
	"last_error",
	"priority",
	"status",
	"updated_at"
)
SELECT
	"asset_key",
	max("attempts"),
	NULL,
	NULL,
	0,
	'queued',
	max("updated_at")
FROM "telegram_files"
WHERE
	"status" IN ('queued', 'downloading')
	AND (
		"byte_size" IS NOT NULL
		OR "media_kind" IN ('avatar', 'document')
	)
GROUP BY "asset_key"
ON CONFLICT ("asset_key") DO NOTHING;
--> statement-breakpoint
DROP INDEX IF EXISTS "telegram_files_status_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_files_asset_idx" ON "telegram_files" USING btree ("asset_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_file_assets_status_idx" ON "telegram_file_assets" USING btree ("status","updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_file_assets_tdlib_file_id_idx" ON "telegram_file_assets" USING btree ("latest_tdlib_file_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_file_download_jobs_status_idx" ON "telegram_file_download_jobs" USING btree ("status","updated_at");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "telegram_file_download_jobs" ADD CONSTRAINT "telegram_file_download_jobs_asset_key_fk" FOREIGN KEY ("asset_key") REFERENCES "telegram_file_assets"("asset_key") ON DELETE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "telegram_files" ADD CONSTRAINT "telegram_files_asset_key_fk" FOREIGN KEY ("asset_key") REFERENCES "telegram_file_assets"("asset_key") ON DELETE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "telegram_files" DROP COLUMN IF EXISTS "attempts";
--> statement-breakpoint
ALTER TABLE "telegram_files" DROP COLUMN IF EXISTS "downloaded_byte_size";
--> statement-breakpoint
ALTER TABLE "telegram_files" DROP COLUMN IF EXISTS "download_error";
--> statement-breakpoint
ALTER TABLE "telegram_files" DROP COLUMN IF EXISTS "last_requested_at";
--> statement-breakpoint
ALTER TABLE "telegram_files" DROP COLUMN IF EXISTS "relative_path";
--> statement-breakpoint
ALTER TABLE "telegram_files" DROP COLUMN IF EXISTS "sha256";
--> statement-breakpoint
ALTER TABLE "telegram_files" DROP COLUMN IF EXISTS "status";
