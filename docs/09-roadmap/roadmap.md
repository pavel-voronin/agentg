# Roadmap

## Phase 1: Telegram Foundation

- Define documentation source of truth.
- Implement TDLib sidecar boundary.
- Authenticate as the Telegram user and persist the session.
- Discover personal chats, groups, channels, and Saved Messages.
- Implement History Sync templates, concrete targets, target range projection,
  and Telegram-owned coverage convergence.
- Store raw events in Postgres.
- Build basic normalized message state for text-oriented messages.
- Store attachment metadata without bulk-downloading payloads.
- Preserve Telegram-specific data model and identifiers.
- Make stored data inspectable directly through Postgres.

## Architecture References

Current architecture is documented in:

- [Component Boundaries](../02-architecture/component-boundaries.md)
- [Data Flow](../02-architecture/data-flow.md)
- [Module Runtime And Extensions](../02-architecture/module-runtime-and-extensions.md)
- [Event Plane](../05-interfaces/event-plane.md)
- [Local Development](../06-operations/local-dev.md)

Roadmap entries must describe only the active target architecture.
