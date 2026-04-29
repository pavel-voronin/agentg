DROP INDEX "backfill_jobs_chat_interval_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "backfill_jobs_chat_interval_unique_idx" ON "backfill_jobs" USING btree ("telegram_chat_id","start_at","end_at");--> statement-breakpoint
CREATE UNIQUE INDEX "history_targets_chat_range_unique_idx" ON "history_targets" USING btree ("telegram_chat_id","range");