# AgenTG Docs

This documentation is the source of truth for the AgenTG project. It is structured for both human use in Obsidian and agent use as operational context.

AgenTG is a Telegram client service for an external personal assistant. It is not the assistant itself, not a Telegram bot, and not a generic private-source memory platform.

The current implementation baseline is the working Telegram foundation: authenticate as the user, synchronize chats, maintain requested visible text history coverage, receive new updates, and store Telegram-shaped text data in Postgres.

Do not pre-document behavior beyond the selected source-of-truth documents. The current selected next layer is addressable derived data through `data`, `pipelines`, `llm-runner`, and `triggers`.

## Core Documents

- [Vision](01-product/vision.md)
- [User Goals](01-product/userGoals.md)
- [Non-Goals](01-product/nonGoals.md)
- [System Overview](02-architecture/systemOverview.md)
- [Component Boundaries](02-architecture/componentBoundaries.md)
- [Module Runtime](02-architecture/moduleRuntime.md)
- [Data Flow](02-architecture/dataFlow.md)
- [Policies](02-architecture/policies.md)
- [Trust Boundaries](02-architecture/trustBoundaries.md)
- [Domain Map](03-domains/domainMap.md)
- [Telegram Client](03-domains/telegramClient.md)
- [Ingestion](03-domains/ingestion.md)
- [Telegram Files](03-domains/telegramFiles.md)
- [Data](03-domains/data.md)
- [Pipelines](03-domains/pipelines.md)
- [LLM Runner](03-domains/llmRunner.md)
- [Triggers](03-domains/triggers.md)
- [TDLib Sidecar API](05-interfaces/tdlibSidecarApi.md)
- [Event Plane](05-interfaces/eventPlane.md)
- [Agent Gateway API](05-interfaces/agentGatewayApi.md)

## Documentation Layers

- `01-product`: why the system exists and what it must not become.
- `02-architecture`: system-level structure and invariants.
- `03-domains`: domain ownership boundaries.
- `04-data`: durable state, schemas, and indexes.
- `05-interfaces`: public and internal boundaries exposed between runtime
  components, domains, and agent-facing clients.
- `06-operations`: running, observing, and recovering the system.
- `07-decisions`: accepted architectural decisions.
- `08-research`: notes that informed decisions but are not themselves source of truth.
- `99-archive`: obsolete documents retained for history.

## Current Direction

AgenTG should behave as a real Telegram client service first. It should ingest and preserve Telegram events according to Telegram mechanics and maintain inspectable Telegram current state in Postgres. The next product layer is addressable derived data over Telegram and other provider-owned models through `data` and YAML `pipelines`.

Short formula:

```text
Telegram reads -> Telegram coverage convergence -> Postgres
Provider model reads -> pipeline nodes -> data annotations and collections
```
