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
- Fetching and persisting historical Telegram pages requested by the History Sync
  Sync domain.
- Computing and storing Telegram history coverage from fetched pages and live
  updates.
- Fetching and persisting operator-requested chat message pages for Control
  Plane read-through views.

Does not own:

- Product-level interpretation of messages.
- Bulk attachment processing.
- Long-running data analysis.

## History Sync

Owns:

- History Sync templates and concrete chat targets.
- Materializing templates into concrete chat targets.
- Projecting target ranges into bounded absolute intervals.
- Sync cadence and wake-up policy.
- Asking Telegram to ensure coverage for absolute intervals through the
  Telegram internal tRPC surface.
- Composing operator read models from History Sync target state and
  Telegram-owned coverage/read state.
- Publishing history sync and target lifecycle events.

Does not own:

- Telegram login, sessions, or TDLib state.
- Telegram message normalization or Telegram-shaped current-state writes.
- Telegram raw event storage.
- Telegram history coverage tables, proof segments, or TDLib page cursors.
- Parsing Telegram raw storage payloads for History Sync read behavior.

## Control Plane

Owns:

- Browser-facing operator shell, slot layout, and WebSocket API.
- Proxying browser RPC calls to domain-owned internal RPC procedures.
- Subscribing to live integration events and forwarding them to the browser.
- Generic operator event stream UI.

Does not own:

- Agent-facing API compatibility.
- Domain Control Plane content components, view models, or UI state.
- History Sync target writes or Telegram history coverage writes.
- Telegram login, sessions, TDLib state, or Telegram-shaped persistence.

## Control Plane SDK

Owns:

- Mechanical slot contracts, resolution, runtime state, and debug inspection.
- Browser host bridge for Control Plane content components.
- Shared UI primitives with no domain behavior.

Does not own:

- Control Plane shell layout.
- Domain content components, view models, or UI state.
- Domain RPC methods, procedure routing, or service topology.

## Agent Gateway

Owns:

- External agent-facing WebSocket API compatibility.
- Authentication and edge policy for external clients.
- Translating external agent calls into internal domain RPC calls where needed.

Does not own:

- Operator UI traffic.
- Internal orchestration between domains.
- History Sync target writes or Telegram history coverage writes.
- Module-owned tRPC implementation.

## Trusted Modules

Own:

- A stable slug and service runtime.
- Module-owned tables and Drizzle migrations.
- Module-owned tRPC methods.
- Module-owned NATS events with the slug prefix.
- Service Directory join and lease renewal for procedures, events, and extension
  getter declarations.
- Declaring whether the service is required for whole-runtime availability.

Do not own:

- Core domain base models.
- Core domain table writes.
- Gateway external protocol compatibility.

## Summaries Pilot Module

Owns:

- `summaries_*` tables for summary runs, results, source references, and
  invalidation state.
- `summaries.*` tRPC methods.
- `summaries.chatSummary` getter for `telegram.chat` model objects.
- `summaries.*` lifecycle events.

Does not own:

- Telegram-shaped message storage.
- History Sync targets or Telegram history coverage.
- Telegram chat base models or any domain-owned base result.

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
