# Roadmap

## Phase 1: Telegram Foundation

- Define documentation source of truth.
- Implement TDLib sidecar boundary.
- Authenticate as the Telegram user and persist the session.
- Discover personal chats, groups, channels, and Saved Messages.
- Implement historical message backfill with configurable limits.
- Store raw events in Postgres.
- Build basic normalized message state for text-oriented messages.
- Store attachment metadata without bulk-downloading payloads.
- Preserve Telegram-specific data model and identifiers.
- Make stored data inspectable directly through Postgres.

## After Phase 1

Do not pre-document later architecture yet. New phases should be added only after the Telegram client foundation works and the next concrete product need is selected.
