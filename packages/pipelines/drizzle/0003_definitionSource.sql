ALTER TABLE "pipelines_definitions"
  ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'manual';
