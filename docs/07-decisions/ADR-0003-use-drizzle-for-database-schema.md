# ADR-0003: Use Drizzle for Database Schema and Migrations

## Status

Accepted for implementation.

## Context

AgenTG needs a stable Postgres contract between Telegram ingestion code and
durable storage. Hand-written bootstrap DDL was useful for the first validation
tests, but it makes schema ownership ambiguous and does not scale well as
normalization and backfill evolve.

## Decision

Use Drizzle for:

- TypeScript schema definitions.
- Versioned SQL migrations.
- Type-safe insert and query code for Postgres.

The schema lives in `packages/database/src/schema.ts`. Generated SQL migrations
live in `packages/database/drizzle/` and are applied explicitly with
`npm run db:migrate`.

## Consequences

Positive:

- database shape is a versioned contract, not an implicit client side effect
- application storage code gets TypeScript types
- SQL migrations are inspectable and commit-friendly

Negative:

- schema changes require a generation step
- generated migrations need review before use
