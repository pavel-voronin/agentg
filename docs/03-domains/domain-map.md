# Domain Map

## Core Domains

- [Telegram Client](telegram-client.md): implement the user-client, Telegram event model, and Telegram API surface.
- [Ingestion](ingestion.md): get Telegram events and historical fetch results into durable storage.
- [History Sync](history-sync.md): manage templates, concrete chat targets, timeline coverage, reconciliation, and backfill jobs.
- Storage: persist raw events and current message state in Postgres.

## Supporting Domains

- Backup and restore.
- Secrets management.
- Observability.

## Important Separation

The system should separate:

- Telegram client session
- raw event log
- current message state
- history targets and coverage
- attachment metadata
