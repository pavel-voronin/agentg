# ADR-0003: Use Drizzle for Database Schema and Migrations

## Status

Accepted for implementation. Updated by
[ADR-0006](adr0006UseTrustedServiceModulesAndRpc.md) for domain-owned schema
and migration placement.

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
migrations. The shared Postgres connector lives in `@agentg/framework`;
module schemas, migration files, and storage code stay module-owned. Migrations
are applied by the owning module startup or module-owned database commands.

## Consequences

Positive:

- database shape is a versioned contract, not an implicit client side effect
- application storage code gets TypeScript types
- SQL migrations are inspectable and commit-friendly

Negative:

- schema changes require a generation step
- generated migrations need review before use
