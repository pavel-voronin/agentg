# Domain Map

## Core Domains

- [Telegram Client](telegramClient.md): implement the user-client, Telegram event model, and Telegram API surface.
- [Telegram Module Architecture](telegramModuleArchitecture.md): define the target TDLib adapter, domain model, repository, storage, procedure, event, and Dashboard boundaries for the Telegram module.
- [Ingestion](ingestion.md): get Telegram events and historical fetch results into durable Telegram-shaped storage.
- [Telegram Files](telegramFiles.md): own Telegram file references, product media cache, download policy, canonical file serving, file events, and file observability.
- [Telegram History Gap Restore](telegramHistoryGapRestore.md): define startup-only policy-driven restoration of bounded history gaps through a direct call to the existing Telegram `getMessages` procedure.
- [LLM Runner](llmRunner.md): own LLM-backed processing over domain content, including direct runs, triggered runs, profiles, run lifecycle, current artifacts, and runner events.
- Telegram Storage: persist normalized Telegram table records, current Telegram
  message state, and Telegram history coverage in Postgres.

## Supporting Domains

- Backup and restore.
- Secrets management.
- Observability.
- Module runtime.
- [Triggers](triggers.md): own `TriggerRule` policy semantics, materialized
  trigger registrations, periodic schedule reconciliation, durable trigger
  occurrences, leases, module procedure dispatch, and trigger events.

## Important Separation

The system should separate:

- Telegram client session
- TDLib update handlers
- Telegram domain tables
- current message state
- Telegram history coverage
- module-owned derived state
- neutral source and content references
- LLM runner runs and artifacts
- TriggerRule policy semantics
- materialized trigger registration runtime state
- module procedure dispatch from trigger registrations
- attachment metadata
- Telegram file assets, slots, jobs, canonical files, and file events
