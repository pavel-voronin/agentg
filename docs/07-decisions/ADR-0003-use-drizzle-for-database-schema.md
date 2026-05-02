# ADR-0003: Use Drizzle for Database Schema and Migrations

## Status

Accepted for implementation. Updated by
[ADR-0006](ADR-0006-use-trusted-service-modules-and-rpc-extensions.md) for
domain-owned schema and migration placement.

## Context

AgenTG needs a stable Postgres contract between Telegram ingestion code and
durable storage. Hand-written bootstrap DDL was useful for the first validation
tests, but it makes schema ownership ambiguous and does not scale well as
normalization and history sync evolve.

## Decision

Use Drizzle for:

- TypeScript schema definitions.
- Versioned SQL migrations.
- Type-safe insert and query code for Postgres.

Each storage-owning domain or module owns its Drizzle schema and generated SQL
migrations. Shared database infrastructure lives in `@agentg/database`.
Migrations are applied explicitly with `npm run db:migrate`.

## Consequences

Positive:

- database shape is a versioned contract, not an implicit client side effect
- application storage code gets TypeScript types
- SQL migrations are inspectable and commit-friendly

Negative:

- schema changes require a generation step
- generated migrations need review before use
