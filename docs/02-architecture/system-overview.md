# System Overview

AgenTG is a Telegram user-client service backed by Postgres.

The first architecture is intentionally simple. It should prove that the system can log in as the user, synchronize Telegram chats, maintain requested visible text history coverage, receive live updates, and persist Telegram-shaped data for later use.

## First Architecture

```text
Telegram / TDLib user-client
  -> TypeScript/Node.js sidecar
  -> Postgres raw event and current-state tables
  -> direct database inspection
```

Additional APIs should be documented only after this loop works reliably.

## Key Invariants

1. AgenTG is a Telegram client service, not a Telegram bot.
2. The normal Telegram client and AgenTG should observe the same visible text messages.
3. New visible text messages should appear in Postgres shortly after Telegram receives them.
4. Historical sync should converge requested history targets into covered timelines.
5. Attachment payloads are lazy; attachment metadata is stored first.
6. Telegram identifiers and semantics must remain available in storage.
7. The first implementation should only depend on the Telegram client, the sidecar runtime, and Postgres.

## First Physical Architecture

For the first implementation, start with:

```text
TDLib sidecar
  -> Postgres append-only event log
  -> normalized message/current-state tables
```

The agent-facing integration adds a separate live boundary:

```text
TDLib sidecar
  -> Postgres
  -> NATS Core live integration events
  <- tRPC history fetch calls from History Sync
  -> History Sync service
  <- tRPC operator calls from Control Plane server
  -> Control Plane browser UI
  -> Agent Gateway WebSocket API
  <-> registered module tRPC capabilities
  -> agent MCP plugin
```

NATS Core is used as an internal, non-durable event bus. Addressed internal
domain reads and commands use tRPC. Postgres remains the source of recovery
and replayable Telegram facts.
History Sync is a separate process from Telegram ingestion: it owns targets,
coverage, and backfill jobs, while Telegram ingestion owns TDLib and
Telegram-shaped persistence.
Control Plane is a separate operator boundary: the browser UI calls Control
Plane server, and Control Plane server calls internal domain RPC directly.
Gateway remains the external agent edge.
Trusted modules run as independent services inside the same internal contour.
They own their storage and tRPC surface, register agent-facing capabilities with
Gateway, and may register extension getter methods in the standalone extension
registry. Callers that need extended views compose them outside the owning
domain by reading registry entries and calling the registered getter RPC
methods.

The preferred starting runtime is TypeScript/Node.js, provided TDLib can be integrated reliably through its JSON/C interface or a maintained wrapper. Go or Rust remain fallback choices if the Node.js integration becomes the risky part of the project.

This first layer should prove authentication, update reception, chat discovery, history target reconciliation, message persistence, and database inspectability for personal chats, groups, and channels. It should focus on text messages and text-bearing message content first.

The first implementation should support history coverage as a desired-state capability. Product policy should live in history templates and concrete chat targets, not in a global backfill scheduler.

The product preference is complete visible text coverage: if the user can see text content in the normal Telegram client, AgenTG should aim to persist it. Attachment payloads can remain lazy and request-driven.
