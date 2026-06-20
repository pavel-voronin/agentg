ALTER TABLE "triggers_registrations"
  DROP COLUMN IF EXISTS "rule_kind",
  DROP COLUMN IF EXISTS "rule_name";

ALTER TABLE "triggers_occurrences"
  DROP COLUMN IF EXISTS "rule_name";
