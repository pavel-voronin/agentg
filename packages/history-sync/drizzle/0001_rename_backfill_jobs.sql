DO $$
BEGIN
  IF to_regclass('public.history_backfill_jobs') IS NULL
    AND to_regclass('public.backfill_jobs') IS NOT NULL THEN
    ALTER TABLE "backfill_jobs" RENAME TO "history_backfill_jobs";
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS "backfill_jobs_status_interval_idx" RENAME TO "history_backfill_jobs_status_interval_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "backfill_jobs_chat_interval_unique_idx" RENAME TO "history_backfill_jobs_chat_interval_unique_idx";
