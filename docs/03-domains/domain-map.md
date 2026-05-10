# Domain Map

## Core Domains

- [Telegram Client](telegram-client.md): implement the user-client, Telegram event model, and Telegram API surface.
- [Ingestion](ingestion.md): get Telegram events and historical fetch results into durable Telegram-shaped storage.
- [History Sync](history.md): manage templates, concrete chat targets, range projection, and sync cadence.
- Telegram Storage: persist raw events, current Telegram message state, and Telegram history coverage in Postgres.
- History Sync Storage: persist templates and concrete chat targets in Postgres.
- Summaries: persist summary runs, results, source references, and invalidation
  state in Postgres.

## Supporting Domains

- Backup and restore.
- Secrets management.
- Observability.
- Service Directory and module runtime.

## Important Separation

The system should separate:

- Telegram client session
- raw event log
- current message state
- History Sync targets
- Telegram history coverage
- module-owned derived state
- attachment metadata
