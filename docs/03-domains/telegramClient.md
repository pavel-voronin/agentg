# Telegram Client

## Responsibility

The Telegram Client domain is the foundation of AgenTG. It owns the user-client
behavior, Telegram event model, Telegram-shaped state, and Telegram API surface.

AgenTG should be useful as a Telegram client first.

## Inputs

- Telegram API / TDLib updates.
- User account session.
- Telegram chats, users, messages, media, reactions, topics, service events, and
  API responses.

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

The long-term direction is broad Telegram API support, not only the subset needed
for initial text message ingestion.

The first implementation can use a narrow operational subset, but the
architecture should not block later support for richer Telegram client
capabilities.

New public procedures should be named and shaped around Telegram product
semantics, not around TDLib functions. A low-level TDLib operation can exist
inside the Telegram module only as a private implementation helper behind a
domain procedure.

For the target pipeline architecture, Telegram exposes data-provider
capabilities for `telegram.chat`, `telegram.message`, and `telegram.user`.
`data` calls those provider procedures for model-level `select`, `get`,
`expand`, and `render` actions. Telegram interprets Telegram model filters such
as chat type, folder placement, pinned state, unread chat state, unread message
state, and message time ranges.

Telegram still owns Telegram readiness, coverage, storage, TDLib access, and
materialization. Pipeline YAML names `telegram.*` models through `data`; it does
not call Telegram storage or TDLib directly.

## Test Contract

- Telegram registers provider capabilities for `telegram.chat`,
  `telegram.message`, and `telegram.user`.
- Telegram provider procedures expose model-level `select`, `get`, `expand`,
  and `render` capabilities without exposing TDLib calls, storage table names,
  coverage internals, page cursors, or materialization strategy switches.
- `select` for `telegram.chat` supports chat id, chat type, folder placement,
  pinned state, and unread chat filters.
- `get` returns one dataset row for an existing `telegram.chat`,
  `telegram.message`, or `telegram.user` ref and returns `null` for a missing
  ref.
- `expand` with relation `messages` from `telegram.chat` rows supports unread
  message filters, message time ranges, and limit.
- `render` for `telegram.message` rows returns deterministic text suitable for
  an LLM input node.
- `render` for `telegram.message` rows supports `options.groupByRef: 'chat'` and
  returns one rendered row per chat ref.
- `render` for `telegram.message` rows without grouping rejects input rows that
  contain multiple distinct refs for the same carried ref key.
- `telegram.chat` rows carry `refs.chat`.
- `telegram.message` rows carry `refs.chat` and `refs.message`.
- `telegram.user` rows carry `refs.user`.
- Provider output rows include stable `ModelRef` values for the returned
  Telegram objects and preserve Telegram identifiers.
- Provider output lineage includes the source chat ref for message expansions.
- Provider procedures reject unsupported model names, unsupported relations, and
  unsupported render formats.
- Provider procedures do not let callers choose TDLib methods, page cursors,
  storage tables, coverage jobs, or file reconciliation behavior.
- Telegram remains the lifecycle owner for readiness and materialization; `data`
  only receives model-level provider results.

## Non-Responsibilities

- Product-level interpretation of messages.
- Bulk attachment processing.
