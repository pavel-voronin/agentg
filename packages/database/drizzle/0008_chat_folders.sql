CREATE TABLE "telegram_chat_folders" (
  "telegram_chat_folder_id" integer PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "icon_name" text,
  "position" integer NOT NULL,
  "raw" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "telegram_chat_folders_position_idx"
ON "telegram_chat_folders" ("position");

WITH latest AS (
  SELECT "payload"
  FROM "telegram_events"
  WHERE "tdlib_update_type" = 'updateChatFolders'
  ORDER BY "ingested_at" DESC
  LIMIT 1
)
INSERT INTO "telegram_chat_folders" (
  "telegram_chat_folder_id",
  "title",
  "icon_name",
  "position",
  "raw"
)
SELECT
  ("folder"."value" ->> 'id')::integer,
  COALESCE(
    "folder"."value" #>> '{name,text,text}',
    "folder"."value" ->> 'title',
    'Folder ' || ("folder"."value" ->> 'id')
  ),
  "folder"."value" #>> '{icon,name}',
  ("folder"."ordinality" - 1)::integer,
  "folder"."value"
FROM latest,
  jsonb_array_elements(latest."payload" -> 'chat_folders') WITH ORDINALITY AS "folder"("value", "ordinality")
WHERE "folder"."value" ? 'id'
ON CONFLICT ("telegram_chat_folder_id") DO UPDATE
SET
  "title" = EXCLUDED."title",
  "icon_name" = EXCLUDED."icon_name",
  "position" = EXCLUDED."position",
  "raw" = EXCLUDED."raw",
  "updated_at" = now();
