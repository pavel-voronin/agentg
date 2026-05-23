# Event Schema

## Purpose

Raw events preserve Telegram facts before normalization.

## Conceptual Shape

```json
{
  "id": "evt_...",
  "telegram_chat_id": "123",
  "telegram_message_id": "456",
  "event_type": "message_created",
  "tdlib_update_type": "updateNewMessage",
  "occurred_at": "2026-04-25T10:00:00+08:00",
  "ingested_at": "2026-04-25T10:00:01+08:00",
  "payload": {},
  "payload_hash": "..."
}
```

## Requirements

- append-only
- replayable
- enough metadata to rebuild current message state
- idempotent ingestion
- raw TDLib payload retained at least during early development
