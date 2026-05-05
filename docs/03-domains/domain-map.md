# Domain Map

## Core Domains

- [Telegram Client](telegram-client.md): implement the user-client, Telegram event model, and Telegram API surface.
- [Ingestion](ingestion.md): get Telegram events and historical fetch results into durable Telegram-shaped storage.
- [History Sync](history-sync.md): manage templates, concrete chat targets, timeline coverage, reconciliation, and backfill jobs.
- Telegram Storage: persist raw events and current Telegram message state in Postgres.
- History Storage: persist templates, targets, coverage, and backfill queue state in Postgres.
- Summaries: persist summary runs, results, source references, and invalidation
  state in Postgres.

## Supporting Domains

- Backup and restore.
- Secrets management.
- Observability.
- Module runtime and extension registration.

## Important Separation

The system should separate:

- Telegram client session
- raw event log
- current message state
- history targets and coverage
- module-owned derived state
- attachment metadata
