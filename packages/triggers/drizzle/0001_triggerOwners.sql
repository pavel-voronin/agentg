ALTER TABLE "triggers_registrations"
  ADD COLUMN IF NOT EXISTS "owner" jsonb,
  ADD COLUMN IF NOT EXISTS "owner_module" text,
  ADD COLUMN IF NOT EXISTS "owner_key" text,
  ADD COLUMN IF NOT EXISTS "name" text;

ALTER TABLE "triggers_occurrences"
  ADD COLUMN IF NOT EXISTS "registration_name" text;

UPDATE "triggers_occurrences"
SET
  "registration_name" = coalesce("registration_name", "registration_key"),
  "status" = CASE
    WHEN "status" IN ('scheduled', 'claimed', 'dispatching', 'retryWaiting') THEN 'cancelled'
    ELSE "status"
  END
WHERE "registration_name" IS NULL
  OR "status" IN ('scheduled', 'claimed', 'dispatching', 'retryWaiting');

DELETE FROM "triggers_registrations";

ALTER TABLE "triggers_registrations"
  ALTER COLUMN "owner" SET NOT NULL,
  ALTER COLUMN "owner_module" SET NOT NULL,
  ALTER COLUMN "owner_key" SET NOT NULL,
  ALTER COLUMN "name" SET NOT NULL;

ALTER TABLE "triggers_occurrences"
  ALTER COLUMN "registration_name" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "triggers_registrations_owner_idx"
  ON "triggers_registrations" ("owner_module", "owner_key");
