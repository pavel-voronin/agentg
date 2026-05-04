# Roadmap

## Phase 1: Telegram Foundation

- Define documentation source of truth.
- Implement TDLib sidecar boundary.
- Authenticate as the Telegram user and persist the session.
- Discover personal chats, groups, channels, and Saved Messages.
- Implement history templates, concrete targets, coverage intervals, and reconciliation into backfill jobs.
- Store raw events in Postgres.
- Build basic normalized message state for text-oriented messages.
- Store attachment metadata without bulk-downloading payloads.
- Preserve Telegram-specific data model and identifiers.
- Make stored data inspectable directly through Postgres.

## After Phase 1

The current architecture migration is tracked separately because it changes
internal domain boundaries rather than product scope.

- [Internal Domain tRPC Migration](internal-domain-trpc-migration.md)
- [Domain Boundary Hardening Plan](domain-boundary-hardening-plan.md)
- [Extension Registry And Direct RPC Migration](extension-registry-direct-rpc-migration.md)
- [Module Runtime And Extensions Plan](module-runtime-and-extensions-plan.md) is
  historical context superseded by the extension-registry migration.
- [Internal Domain RPC Migration](internal-domain-rpc-migration.md) is historical
  gRPC/Protobuf context superseded by the tRPC migration plan.

Do not advance between migration stages without re-planning the stage and meeting
its Definition of Done.
