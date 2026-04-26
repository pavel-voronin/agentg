# Message State

## Purpose

Message state provides the current canonical view of Telegram messages.

## Handles

- new messages
- edits
- deletes
- reactions
- replies
- threads
- media metadata
- service messages

## Conceptual Shape

```json
{
  "chat_id": "123",
  "message_id": "456",
  "sender_id": "789",
  "sent_at": "2026-04-25T10:00:00+08:00",
  "text": "message text",
  "message_type": "text",
  "reply_to_message_id": "455",
  "is_deleted": false,
  "edited_at": null,
  "media": [],
  "updated_at": "2026-04-25T10:00:02+08:00"
}
```

## Invariant

Current message state is derived from raw events. It is not the immutable source of truth.

