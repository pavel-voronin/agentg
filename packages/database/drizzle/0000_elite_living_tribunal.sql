CREATE TABLE IF NOT EXISTS "telegram_chats" (
	"raw" jsonb NOT NULL,
	"telegram_chat_id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_events" (
	"event_key" text NOT NULL,
	"event_type" text NOT NULL,
	"id" bigserial PRIMARY KEY NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"occurred_at" timestamp with time zone,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"tdlib_update_type" text NOT NULL,
	"telegram_chat_id" text,
	"telegram_message_id" text,
	CONSTRAINT "telegram_events_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_messages" (
	"content_type" text NOT NULL,
	"edit_date" timestamp with time zone,
	"message_date" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"sender_id" text,
	"sender_type" text,
	"telegram_chat_id" text NOT NULL,
	"telegram_message_id" text NOT NULL,
	"text" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_messages_telegram_chat_id_telegram_message_id_pk" PRIMARY KEY("telegram_chat_id","telegram_message_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_sync_state" (
	"key" text PRIMARY KEY NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_users" (
	"first_name" text NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"last_name" text NOT NULL,
	"raw" jsonb NOT NULL,
	"telegram_user_id" text PRIMARY KEY NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"username" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_events_chat_time_idx" ON "telegram_events" USING btree ("telegram_chat_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_messages_chat_date_idx" ON "telegram_messages" USING btree ("telegram_chat_id","message_date");
