ALTER TABLE "telegram_messages" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "telegram_messages" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false NOT NULL;
