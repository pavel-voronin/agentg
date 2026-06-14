# Component Boundaries

This document defines the boundaries needed for the first implementation.

## Telegram Module

Owns:

- Telegram login and session state.
- TDLib local database.
- Receiving live Telegram updates.
- Fetching chat lists and historical messages through private TDLib operations.
- Exposing Telegram domain procedures for Telegram client commands and reads.
- Handling TDLib inputs through explicit update handlers.
- Materializing requested Telegram history into Telegram-owned storage.
- Computing and storing Telegram history coverage from fetched pages and live
  updates.
- Serving Telegram messages, chats, files, and coverage through domain-level
  reads that hide TDLib, storage, cursor, and materialization mechanics.

Does not own:

- Product-level interpretation of messages.
- Bulk attachment processing.
- Long-running data analysis.
- Exposing TDLib-shaped operations, page cursors, raw history fetch procedures,
  or other lower-level implementation controls to other domains.

## Dashboard

Owns:

- Browser-facing operator shell, slot layout, and WebSocket API.
- Proxying browser RPC calls to domain-owned internal RPC procedures.
- Subscribing to live integration events and forwarding them to the browser.
- Generic operator event stream UI.

Does not own:

- Agent-facing API compatibility.
- Domain Dashboard content components, view models, or UI state.
- Telegram history coverage writes.
- Telegram login, sessions, TDLib state, or Telegram-shaped persistence.

## Dashboard SDK

Owns:

- Mechanical slot contracts, resolution, runtime state, and debug inspection.
- Browser host bridge for Dashboard content components.
- Shared UI primitives with no domain behavior.

Does not own:

- Dashboard shell layout.
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
- Telegram history coverage writes.
- Module-owned module RPC implementation.

## Trusted Modules

Own:

- A stable slug and service runtime.
- Module-owned tables and Drizzle migrations.
- Module-owned module RPC methods.
- Module-owned NATS events with the slug prefix.
- A package-owned typed RPC client exported from the package root when another
  package has a current consumer.
- Runtime addresses supplied by the local process or container contour.

Do not own:

- Core domain base models.
- Core domain table writes.
- Gateway external protocol compatibility.

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
