# Telegram Client

## Responsibility

The Telegram Client domain is the foundation of AgenTG. It owns the user-client behavior, Telegram event model, Telegram-shaped state, and Telegram API surface.

AgenTG should be useful as a Telegram client first.

## Inputs

- Telegram API / TDLib updates.
- User account session.
- Telegram chats, users, messages, media, reactions, topics, permissions, service events, and API responses.

## Outputs

- Normalized Telegram domain table records.
- Telegram-shaped current state and TDLib update diagnostics.
- Optional Telegram write operations exposed at the client boundary.

## Invariants

- Telegram mechanics should not be flattened into a generic message-feed model.
- TDLib is an implementation detail of this domain. It must not appear in
  procedure names, caller choices, Dashboard contracts, Gateway contracts, or
  other module boundaries.
- Public Telegram procedures expose Telegram domain capabilities. They must not
  expose raw TDLib calls, page fetches, TDLib cursors, coverage internals, file
  reconciliation controls, or materialization strategy switches.
- Consumers ask Telegram for the domain result they need. Telegram decides
  internally whether the answer can be returned from storage, requires
  materialization, or should complete asynchronously and publish a domain event.
- Incoming Telegram updates should be handled by explicit update handlers or
  reported as malformed or unhandled diagnostics.
- Current state should be reconstructable from Telegram domain tables where
  practical.
- Telegram identifiers and semantics should remain available in storage.

## API Surface Direction

The long-term direction is broad Telegram API support, not only the subset needed for initial text message ingestion.

The first implementation can use a narrow operational subset, but the
architecture should not block later support for richer Telegram client
capabilities.

New public procedures should be named and shaped around Telegram product
semantics, not around TDLib functions. A low-level TDLib operation can exist
inside the Telegram module only as a private implementation helper behind a
domain procedure.

## Non-Responsibilities

- Product-level interpretation of messages.
- Bulk attachment processing.
