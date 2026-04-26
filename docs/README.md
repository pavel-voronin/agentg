# AgenTG Docs

This documentation is the source of truth for the AgenTG project. It is structured for both human use in Obsidian and agent use as operational context.

AgenTG is a Telegram client service for an external personal assistant. It is not the assistant itself, not a Telegram bot, and not a generic private-source memory platform.

The current implementation baseline is the working Telegram foundation: authenticate as the user, synchronize chats, backfill visible text history where feasible, receive new updates, and store Telegram-shaped text data in Postgres.

Do not pre-document higher-level assistant behavior. Add it only after the Telegram client and storage loop work reliably and the next concrete task is selected.

## Core Documents

- [Vision](01-product/vision.md)
- [User Goals](01-product/user-goals.md)
- [Non-Goals](01-product/non-goals.md)
- [Privacy Principles](01-product/privacy-principles.md)
- [System Overview](02-architecture/system-overview.md)
- [Component Boundaries](02-architecture/component-boundaries.md)
- [Data Flow](02-architecture/data-flow.md)
- [Trust Boundaries](02-architecture/trust-boundaries.md)
- [Domain Map](03-domains/domain-map.md)
- [Telegram Client](03-domains/telegram-client.md)
- [Ingestion](03-domains/ingestion.md)
- [Data Model](04-data/data-model.md)
- [TDLib Sidecar API](05-interfaces/tdlib-sidecar-api.md)
- [Agent Gateway API](05-interfaces/agent-gateway-api.md)
- [MVP](09-roadmap/mvp.md)

## Documentation Layers

- `01-product`: why the system exists and what it must not become.
- `02-architecture`: system-level structure and invariants.
- `03-domains`: domain capabilities and ownership boundaries.
- `04-data`: durable state, schemas, indexes, and retention.
- `05-interfaces`: internal interfaces needed by the Telegram client foundation.
- `06-operations`: running, securing, observing, and recovering the system.
- `07-decisions`: accepted architectural decisions.
- `08-research`: notes that informed decisions but are not themselves source of truth.
- `09-roadmap`: current plan, MVP scope, and backlog.
- `99-archive`: obsolete documents retained for history.

## Current Direction

AgenTG should behave as a real Telegram client service first. It should ingest and preserve Telegram events according to Telegram mechanics and maintain inspectable Telegram current state in Postgres.

Short formula:

```text
Telegram user-client -> visible text sync -> Postgres
```
