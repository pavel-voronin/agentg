# Component Boundaries

This document defines the boundaries needed for the first implementation.

## TDLib Sidecar

Owns:

- Telegram login and session state.
- TDLib local database.
- Receiving live Telegram updates.
- Fetching chat lists and historical messages.
- Exposing a small internal tRPC API for Telegram client commands and reads.
- Passing raw Telegram facts to storage.
- Fetching and persisting historical Telegram pages requested by the History
  Sync domain.

Does not own:

- Product-level interpretation of messages.
- Bulk attachment processing.
- Long-running data analysis.

## History Sync

Owns:

- History templates, concrete chat targets, coverage intervals, and backfill
  job state.
- Reconciling desired history coverage against existing coverage.
- Scheduling and checkpointing backfill jobs.
- Requesting Telegram history pages through the Telegram internal tRPC surface.
- Composing history read models from History-owned state and Telegram-owned read
  models.
- Publishing history lifecycle and coverage events.

Does not own:

- Telegram login, sessions, or TDLib state.
- Telegram message normalization or Telegram-shaped current-state writes.
- Telegram raw event storage.
- Parsing Telegram raw storage payloads for History read behavior.

## Control Plane

Owns:

- Browser-facing operator UI and WebSocket API.
- Translating operator UI calls into internal domain RPC calls.
- Subscribing to live integration events needed by operator views.

Does not own:

- Agent-facing API compatibility.
- History targets, coverage, or backfill job writes.
- Telegram login, sessions, TDLib state, or Telegram-shaped persistence.

## Agent Gateway

Owns:

- External agent-facing WebSocket API compatibility.
- Authentication and edge policy for external clients.
- Translating external agent calls into internal domain RPC calls where needed.
- Aggregating active module capabilities through the in-memory capability
  registry.
- Proxying capability execution to the owning module tRPC method.

Does not own:

- Operator UI traffic.
- Internal orchestration between domains.
- History targets, coverage, or backfill job writes.
- Module-owned capability implementation.

## Trusted Modules

Own:

- A stable slug and service runtime.
- Module-owned tables and Drizzle migrations.
- Module-owned tRPC methods.
- Module-owned NATS events with the slug prefix.
- Gateway capability registration and refresh.
- Extension registration and refresh against enriched target methods.

Do not own:

- Core domain base models.
- Core domain table writes.
- Gateway external protocol compatibility.

## Summaries Pilot Module

Owns:

- `summaries_*` tables for summary runs, results, source references, and
  invalidation state.
- `summaries.*` tRPC methods.
- `summaries.requestChatSummary` Gateway capability.
- `summaries.chatSummary` extension for `history.getChatHistoryState`.
- `summaries.*` lifecycle events.

Does not own:

- Telegram-shaped message storage.
- History targets, coverage, or backfill jobs.
- The base `history.getChatHistoryState` result.

## Storage Layer

Owns:

- Shared database infrastructure: Postgres pool creation, Drizzle client
  creation, health checks, and migration runner helpers.

Does not own:

- Domain or module schemas.
- Centralized migrations.
- Telegram session credentials.
- Telegram network calls.

## Normalization

Owns:

- Converting TDLib objects into stable Postgres records.
- Preserving Telegram identifiers.
- Updating current message state after new messages, edits, deletes, and basic metadata changes.

Does not own:

- Non-Telegram abstractions.
- Attachment payload processing beyond initial metadata.
