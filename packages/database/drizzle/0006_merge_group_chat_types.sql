UPDATE "telegram_chats"
SET "type" = 'group'
WHERE "type" IN ('basicGroup', 'supergroup')
  OR "raw" -> 'type' ->> '_' = 'chatTypeBasicGroup'
  OR (
    "raw" -> 'type' ->> '_' = 'chatTypeSupergroup'
    AND COALESCE("raw" -> 'type' ->> 'is_channel', 'false') <> 'true'
  );
