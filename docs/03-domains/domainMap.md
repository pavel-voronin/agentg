# Domain Map

## Core Domains

- [Telegram Client](telegramClient.md): implement the user-client, Telegram event model, and Telegram API surface.
- [Ingestion](ingestion.md): get Telegram events and historical fetch results into durable Telegram-shaped storage.
- [Telegram Files](telegramFiles.md): own Telegram file references, product media cache, download policy, canonical file serving, file events, and file observability.
- [History Sync](historySync.md): manage templates, concrete chat targets, range projection, and sync cadence.
- Telegram Storage: persist normalized Telegram table records, current Telegram
  message state, and Telegram history coverage in Postgres.
- History Sync Storage: persist templates and concrete chat targets in Postgres.

## Supporting Domains

- Backup and restore.
- Secrets management.
- Observability.
- Module runtime.

## Important Separation

The system should separate:

- Telegram client session
- TDLib update handlers
- Telegram domain tables
- current message state
- History Sync targets
- Telegram history coverage
- module-owned derived state
- attachment metadata
- Telegram file assets, slots, jobs, canonical files, and file events
