# System Overview

AgenTG is a Telegram user-client service backed by Postgres.

The first architecture proves that the system can log in as the user,
synchronize Telegram chats, maintain requested visible text history coverage,
receive live updates, and persist Telegram-shaped data for later use. The next
architecture layer adds addressable derived data and YAML pipelines over that
Telegram foundation.

## First Architecture

```text
Telegram / TDLib user-client
  -> TypeScript/Node.js sidecar
  -> TDLib update handlers
  -> Postgres Telegram domain tables
  -> direct database inspection
```

Additional APIs live in their owning documents. This overview keeps the Telegram
foundation invariants separate from the derived-data layer.

## Key Invariants

1. AgenTG is a Telegram client service, not a Telegram bot.
2. The normal Telegram client and AgenTG should observe the same visible text messages.
3. New visible text messages should appear in Postgres shortly after Telegram receives them.
4. Historical fetches should converge requested Telegram reads into covered timelines.
5. Attachment payloads are lazy; attachment metadata is stored first.
6. Telegram identifiers and semantics must remain available in storage.
7. The Telegram foundation layer should only depend on the Telegram client, the sidecar runtime, and Postgres.

## First Physical Architecture

For the first implementation, start with:

```text
TDLib sidecar
  -> TDLib update handlers
  -> Telegram domain tables
  -> malformed or unhandled TDLib update diagnostics
```

The derived-data layer adds:

```text
Telegram domain reads
  -> data provider model space
  -> pipeline nodes
  -> llm-runner action nodes
  -> data annotations and collections
```

The agent-facing integration adds a separate live boundary:

```text
TDLib sidecar
  -> Postgres
  -> NATS Core live integration events
  <- module RPC operator calls from Dashboard server
  -> Dashboard browser UI
  -> Agent Gateway WebSocket API
  -> Codex MCP server
```

NATS Core is used as an internal, non-durable event bus. Addressed internal
domain reads and commands use module RPC. Postgres remains the source of recovery
through Telegram domain tables, Telegram history coverage, pipeline run state,
and data-owned annotations and collections.
Telegram ingestion owns TDLib, Telegram-shaped persistence, page continuity,
and Telegram history coverage.
TDLib and page continuity stay inside Telegram; other services request Telegram
domain outcomes and do not select TDLib methods, page cursors, history fetch
strategy, or file reconciliation strategy.
Dashboard is a separate operator boundary: the browser UI calls Dashboard
server, and Dashboard server exposes Dashboard-owned backend procedures that
call typed module clients. The browser UI is composed from slots: Dashboard owns
the shell, layout, browser WebSocket, and event fanout; domains provide the
concrete Dashboard content components and own their view state. Dashboard SDK
owns the mechanical slot runtime, host bridge, debug overlay, and shared UI
primitives used by those content components. Gateway remains the external agent
edge and calls its allowed internal dependencies through typed module clients.
Codex MCP exposes explicit tools over Gateway and does not bypass Gateway into
domain RPC.
Default operator layout is derived from domain-declared Dashboard content
placements. The shell does not hard-code domain content IDs into its own layout.
Telegram ingestion and trusted modules run as independent services inside the
same internal contour. They own their storage and module RPC surface. Internal
addresses are supplied by the process or container contour, and cross-module
callers import the owning package's typed client. Gateway methods are managed
directly in Gateway code. Product views that combine multiple owners are
explicit RPC or Dashboard UI contracts owned by the appropriate boundary.
Operator UI composition uses domain-provided Dashboard slot content rather than
shell-owned domain view models.

`data` provides shared model refs and provider routing, but it does not replace
Telegram as the owner of Telegram ingestion, coverage, edits, deletes, or file
lifecycle. `pipelines` stores named pipeline definitions and registers schedules
with `triggers`; `triggers` wakes the pipeline runtime.

The preferred starting runtime is TypeScript/Node.js, provided TDLib can be integrated reliably through its JSON/C interface or a maintained wrapper. If Node.js integration becomes the risky part of the project, re-plan the sidecar runtime before implementation continues.

This first layer should prove authentication, update reception, chat discovery,
Telegram coverage convergence, message persistence, and database inspectability
for personal chats, groups, and channels. It should focus on text messages and
text-bearing message content first.

The first implementation should support history coverage as a Telegram-owned
capability. Telegram owns the operational coverage state that proves local
Telegram message history has no enumeration gaps for covered intervals.

The product preference is complete visible text coverage: if the user can see text content in the normal Telegram client, AgenTG should aim to persist it. Attachment payloads can remain lazy and request-driven.

## Acceptance Test Contract

- The Telegram foundation proves login, chat synchronization, live update
  receipt, text message persistence, and inspectable Telegram-shaped records in
  Postgres.
- Telegram history reads converge into Telegram-owned coverage without exposing
  TDLib page cursors or coverage materialization controls to other modules.
- Non-Telegram modules do not import TDLib helpers or read Telegram-owned
  storage tables directly.
- The derived-data layer proves the path from Telegram domain reads through
  `data`, `pipelines`, optional `llm-runner`, and back into data-owned
  annotations or collections.
- `data` provider routing does not transfer Telegram ingestion, coverage, edits,
  deletes, or file lifecycle ownership out of Telegram.
- `pipelines` schedule declarations register through `triggers`; `triggers`
  wakes the pipeline runtime and does not store pipeline YAML.
- Codex MCP exposes only explicit tools over documented Gateway methods.
