CREATE TABLE IF NOT EXISTS "triggers_registrations" (
  "key" text PRIMARY KEY NOT NULL,
  "owner" jsonb NOT NULL,
  "owner_module" text NOT NULL,
  "owner_key" text NOT NULL,
  "name" text NOT NULL,
  "schedule" jsonb NOT NULL,
  "action" jsonb NOT NULL,
  "anchor_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "triggers_registrations_owner_idx"
  ON "triggers_registrations" ("owner_module", "owner_key");

CREATE TABLE IF NOT EXISTS "triggers_occurrences" (
  "key" text PRIMARY KEY NOT NULL,
  "registration_key" text NOT NULL,
  "registration_name" text NOT NULL,
  "scheduled_at" timestamp with time zone NOT NULL,
  "status" text NOT NULL,
  "action" jsonb NOT NULL,
  "lease_owner" text,
  "lease_expires_at" timestamp with time zone,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp with time zone NOT NULL,
  "provider_run_id" text,
  "failure_code" text,
  "failure_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "triggers_occurrences_due_idx"
  ON "triggers_occurrences" ("status", "next_attempt_at");

CREATE INDEX IF NOT EXISTS "triggers_occurrences_registration_idx"
  ON "triggers_occurrences" ("registration_key", "scheduled_at");
