# Domain Map

## Core Domains

- [Telegram Client](telegramClient.md): implement the user-client, Telegram event model, and Telegram API surface.
- [Ingestion](ingestion.md): get Telegram events and historical fetch results into durable Telegram-shaped storage.
- [Telegram Files](telegramFiles.md): own Telegram file references, product media cache, download policy, canonical file serving, file events, and file observability.
- [Telegram History Gap Restore](telegramHistoryGapRestore.md): define startup-only policy-driven restoration of bounded history gaps through a direct call to the existing Telegram `getMessages` procedure.
- Telegram Storage: persist normalized Telegram table records, current Telegram
  message state, and Telegram history coverage in Postgres.

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
- Telegram history coverage
- module-owned derived state
- attachment metadata
- Telegram file assets, slots, jobs, canonical files, and file events
