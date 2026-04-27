# Observability

## Metrics To Track

- updates ingested per chat
- normalization failures
- live update lag
- history target coverage per chat
- missing history intervals per chat
- backfill job queue depth and age
- failed TDLib requests
- Postgres write latency
- duplicate event count
- attachment metadata count

## Debug Views

The system should support answering:

- Is the Telegram session authenticated?
- Which chats have been discovered?
- Which history targets exist for a chat?
- Which intervals are covered or missing for a chat?
- Which backfill jobs are running?
- When was the last update received?
- Was a specific Telegram message persisted?
- Which raw event produced a specific current message record?
