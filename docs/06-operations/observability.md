# Observability

## Metrics To Track

- updates ingested per chat
- normalization failures
- live update lag
- historical backfill progress per chat
- failed TDLib requests
- Postgres write latency
- duplicate event count
- attachment metadata count

## Debug Views

The system should support answering:

- Is the Telegram session authenticated?
- Which chats have been discovered?
- Which chat is currently being backfilled?
- When was the last update received?
- Was a specific Telegram message persisted?
- Which raw event produced a specific current message record?
