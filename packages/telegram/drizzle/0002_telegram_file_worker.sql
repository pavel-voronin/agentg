CREATE TABLE "telegram_file_assets" (
  "asset_key" text PRIMARY KEY NOT NULL,
  "byte_size" bigint,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "downloaded_byte_size" bigint,
  "download_error" text,
  "latest_tdlib_file_id" integer,
  "relative_path" text,
  "sha256" text,
  "status" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_tdlib_files" (
  "expected_size" bigint,
  "local_can_be_deleted" boolean NOT NULL,
  "local_can_be_downloaded" boolean NOT NULL,
  "local_download_offset" bigint NOT NULL,
  "local_downloaded_prefix_size" bigint NOT NULL,
  "local_downloaded_size" bigint NOT NULL,
  "local_is_downloading_active" boolean NOT NULL,
  "local_is_downloading_completed" boolean NOT NULL,
  "local_path" text NOT NULL,
  "remote_id" text NOT NULL,
  "remote_is_uploading_active" boolean NOT NULL,
  "remote_is_uploading_completed" boolean NOT NULL,
  "remote_unique_id" text NOT NULL,
  "remote_uploaded_size" bigint NOT NULL,
  "size" bigint,
  "tdlib_file_id" integer PRIMARY KEY NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_file_download_jobs" (
  "asset_key" text PRIMARY KEY NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "claimed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_error" text,
  "priority" integer DEFAULT 0 NOT NULL,
  "status" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "telegram_file_download_jobs_asset_key_fk" FOREIGN KEY ("asset_key") REFERENCES "telegram_file_assets"("asset_key") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE "telegram_file_slots" (
  "asset_key" text NOT NULL,
  "byte_size" bigint,
  "duration_seconds" integer,
  "file_name" text,
  "height" integer,
  "media_kind" text NOT NULL,
  "mime_type" text,
  "owner_id" text NOT NULL,
  "owner_model" text NOT NULL,
  "render_kind" text NOT NULL,
  "slot_key" text NOT NULL,
  "tdlib_file_id" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "width" integer,
  CONSTRAINT "telegram_file_slots_owner_model_owner_id_slot_key_pk" PRIMARY KEY ("owner_model", "owner_id", "slot_key"),
  CONSTRAINT "telegram_file_slots_asset_key_fk" FOREIGN KEY ("asset_key") REFERENCES "telegram_file_assets"("asset_key") ON DELETE CASCADE,
  CONSTRAINT "telegram_file_slots_tdlib_file_id_fk" FOREIGN KEY ("tdlib_file_id") REFERENCES "telegram_tdlib_files"("tdlib_file_id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "telegram_file_assets_status_idx" ON "telegram_file_assets" ("status", "updated_at");
--> statement-breakpoint
CREATE INDEX "telegram_file_assets_tdlib_file_id_idx" ON "telegram_file_assets" ("latest_tdlib_file_id");
--> statement-breakpoint
CREATE INDEX "telegram_tdlib_files_remote_unique_id_idx" ON "telegram_tdlib_files" ("remote_unique_id");
--> statement-breakpoint
CREATE INDEX "telegram_tdlib_files_local_completed_idx" ON "telegram_tdlib_files" ("local_is_downloading_completed");
--> statement-breakpoint
CREATE INDEX "telegram_file_download_jobs_status_idx" ON "telegram_file_download_jobs" ("status", "updated_at");
--> statement-breakpoint
CREATE INDEX "telegram_file_slots_asset_idx" ON "telegram_file_slots" ("asset_key");
--> statement-breakpoint
CREATE INDEX "telegram_file_slots_owner_idx" ON "telegram_file_slots" ("owner_model", "owner_id");
--> statement-breakpoint
CREATE INDEX "telegram_file_slots_tdlib_file_id_idx" ON "telegram_file_slots" ("tdlib_file_id");
