CREATE TABLE IF NOT EXISTS "data_annotations" (
  "subject_model" text NOT NULL,
  "subject_id" text NOT NULL,
  "key" text NOT NULL,
  "value" jsonb NOT NULL,
  "lineage" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "data_annotations_pk" PRIMARY KEY ("subject_model", "subject_id", "key")
);

CREATE INDEX IF NOT EXISTS "data_annotations_subject_idx"
  ON "data_annotations" ("subject_model", "subject_id");

CREATE INDEX IF NOT EXISTS "data_annotations_subject_key_idx"
  ON "data_annotations" ("subject_model", "subject_id", "key");

CREATE TABLE IF NOT EXISTS "data_collection_items" (
  "subject_model" text NOT NULL,
  "subject_id" text NOT NULL,
  "key" text NOT NULL,
  "item_id" text NOT NULL,
  "value" jsonb NOT NULL,
  "lineage" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "data_collection_items_pk" PRIMARY KEY ("subject_model", "subject_id", "key", "item_id")
);

CREATE INDEX IF NOT EXISTS "data_collection_items_subject_idx"
  ON "data_collection_items" ("subject_model", "subject_id");

CREATE INDEX IF NOT EXISTS "data_collection_items_subject_key_idx"
  ON "data_collection_items" ("subject_model", "subject_id", "key");
