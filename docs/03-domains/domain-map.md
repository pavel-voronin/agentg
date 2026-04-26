# Domain Map

## Core Domains

- [Telegram Client](telegram-client.md): implement the user-client, Telegram event model, and Telegram API surface.
- [Ingestion](ingestion.md): get Telegram events and historical fetch results into durable storage.
- Storage: persist raw events and current message state in Postgres.
- Historical Sync: backfill visible text history and track progress per chat.

## Supporting Domains

- Backup and restore.
- Secrets management.
- Observability.

## Important Separation

The system should separate:

- Telegram client session
- raw event log
- current message state
- chat sync progress
- attachment metadata
