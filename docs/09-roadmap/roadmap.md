# Roadmap

## Phase 1: Telegram Foundation

- Define documentation source of truth.
- Implement TDLib sidecar boundary.
- Authenticate as the Telegram user and persist the session.
- Discover personal chats, groups, channels, and Saved Messages.
- Implement Telegram-owned coverage convergence for requested Telegram reads.
- Store normalized Telegram table records in Postgres.
- Build basic normalized message state for text-oriented messages.
- Store attachment metadata without bulk-downloading payloads.
- Preserve Telegram-specific data model and identifiers.
- Make stored data inspectable directly through Postgres.

## Architecture References

Current architecture is documented in:

- [Component Boundaries](../02-architecture/componentBoundaries.md)
- [Data Flow](../02-architecture/dataFlow.md)
- [Module Runtime](../02-architecture/moduleRuntime.md)
- [Event Plane](../05-interfaces/eventPlane.md)
- [Local Development](../06-operations/localDev.md)

Roadmap entries must describe only the active target architecture.
