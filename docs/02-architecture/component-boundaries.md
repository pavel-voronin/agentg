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
- Fetching and persisting operator-requested chat message pages for Control
  Plane read-through views.

Does not own:

- Product-level interpretation of messages.
- Bulk attachment processing.
- Long-running data analysis.

## History

Owns:

- History templates, concrete chat targets, coverage intervals, and backfill
  job state.
- Reconciling desired history coverage against existing coverage.
- Scheduling and checkpointing backfill jobs.
- Requesting Telegram history pages through the Telegram internal tRPC surface.
- Composing history read models from History-owned state and Telegram-owned read
  models.
- Publishing history lifecycle and coverage events.
- Extending coverage from observed Telegram message-page events.

Does not own:

- Telegram login, sessions, or TDLib state.
- Telegram message normalization or Telegram-shaped current-state writes.
- Telegram raw event storage.
- Parsing Telegram raw storage payloads for History read behavior.

## Control Plane

Owns:

- Browser-facing operator shell, slot layout, and WebSocket API.
- Proxying browser RPC calls to domain-owned internal RPC procedures.
- Subscribing to live integration events and forwarding them to the browser.
- Generic operator event stream UI.

Does not own:

- Agent-facing API compatibility.
- Domain Control Plane content components, view models, or UI state.
- History targets, coverage, or backfill job writes.
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
- History targets, coverage, or backfill job writes.
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
- History targets, coverage, or backfill jobs.
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
