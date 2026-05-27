CREATE TABLE "telegram_history_live_windows" (
  "closed_at" timestamp with time zone,
  "close_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "id" bigserial PRIMARY KEY NOT NULL,
  "start_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_history_live_chats" (
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "eligible_from" timestamp with time zone NOT NULL,
  "telegram_chat_id" text PRIMARY KEY NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "telegram_history_live_windows_closed_idx" ON "telegram_history_live_windows" ("closed_at");
--> statement-breakpoint
CREATE INDEX "telegram_history_live_windows_interval_idx" ON "telegram_history_live_windows" ("start_at", "end_at");
--> statement-breakpoint
CREATE INDEX "telegram_history_live_chats_eligible_idx" ON "telegram_history_live_chats" ("eligible_from");
