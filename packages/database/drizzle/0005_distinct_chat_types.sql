UPDATE "telegram_chats"
SET "type" = CASE
  WHEN "raw" -> 'type' ->> '_' = 'chatTypePrivate' THEN 'private'
  WHEN "raw" -> 'type' ->> '_' = 'chatTypeSecret' THEN 'secret'
  WHEN "raw" -> 'type' ->> '_' = 'chatTypeBasicGroup' THEN 'basicGroup'
  WHEN "raw" -> 'type' ->> '_' = 'chatTypeSupergroup'
    AND "raw" -> 'type' ->> 'is_channel' = 'true' THEN 'channel'
  WHEN "raw" -> 'type' ->> '_' = 'chatTypeSupergroup' THEN 'supergroup'
  ELSE "type"
END
WHERE "raw" -> 'type' ->> '_' IN (
  'chatTypePrivate',
  'chatTypeSecret',
  'chatTypeBasicGroup',
  'chatTypeSupergroup'
);
