# Domain Map

## Core Domains

- [Telegram Client](telegramClient.md): implement the user-client, Telegram event model, and Telegram API surface.
- [Telegram Module Architecture](telegramModuleArchitecture.md): define the target TDLib adapter, domain model, repository, storage, procedure, event, and Dashboard boundaries for the Telegram module.
- [Ingestion](ingestion.md): get Telegram events and historical fetch results into durable Telegram-shaped storage.
- [Telegram Files](telegramFiles.md): own Telegram file references, product media cache, download policy, canonical file serving, file events, and file observability.
- [Telegram History Gap Restore](telegramHistoryGapRestore.md): define startup-only policy-driven restoration of bounded history gaps through a direct call to the existing Telegram `getMessages` procedure.
- [Data](data.md): own the shared addressable model space, model refs, provider routing, schema-free annotations, collections, and data pipeline actions.
- [Pipelines](pipelines.md): own `PipelineAutomationRule` policy, materialized pipeline definitions, pipeline run lifecycle, node execution, schedule registration with `triggers`, and the agent-facing [Pipeline Spec](pipelineSpec.md).
- [LLM Runner](llmRunner.md): own LLM action execution for pipeline nodes, profiles, provider adapters, and LLM run lifecycle.
- Telegram Storage: persist normalized Telegram table records, current Telegram
  message state, and Telegram history coverage in Postgres.

## Supporting Domains

- Backup and restore.
- Secrets management.
- Observability.
- Module runtime.
- [Triggers](triggers.md): own materialized trigger registrations, periodic
  schedule reconciliation, durable trigger occurrences, leases, module procedure
  dispatch, and trigger events.

## Important Separation

The system should separate:

- Telegram client session
- TDLib update handlers
- Telegram domain tables
- current message state
- Telegram history coverage
- shared addressable model refs
- data provider routing
- schema-free annotations and collections
- durable pipeline node datasets
- pipeline automation policy, materialized definitions, and pipeline runs
- LLM action runs
- materialized trigger registration runtime state
- module procedure dispatch from trigger registrations
- attachment metadata
- Telegram file assets, slots, jobs, canonical files, and file events

## Acceptance Pointers

- Telegram provider capabilities are accepted by [Telegram Client](telegramClient.md).
- Shared model refs, provider routing, annotations, and collections are accepted
  by [Data](data.md).
- Pipeline automation policy, materialized definitions, run lifecycle, node
  execution, and schedule registration are accepted by [Pipelines](pipelines.md).
- LLM action execution and profile behavior are accepted by
  [LLM Runner](llmRunner.md).
- Trigger registration, occurrence, lease, and dispatch behavior are accepted by
  [Triggers](triggers.md).
