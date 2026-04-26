# Telegram Client

## Responsibility

The Telegram Client domain is the foundation of AgenTG. It owns the user-client behavior, Telegram event model, Telegram-shaped state, and Telegram API surface.

AgenTG should be useful as a Telegram client first.

## Inputs

- Telegram API / TDLib updates.
- User account session.
- Telegram chats, users, messages, media, reactions, topics, permissions, service events, and API responses.

## Outputs

- Raw Telegram events.
- Telegram-shaped current state.
- Optional Telegram write operations exposed at the client boundary.

## Invariants

- Telegram mechanics should not be flattened into a generic message-feed model.
- All incoming Telegram events should be persistable.
- Current state should be reconstructable from raw events where practical.
- Telegram identifiers and semantics should remain available in storage.

## API Surface Direction

The long-term direction is broad Telegram API support, not only the subset needed for initial text message ingestion.

The first implementation can use a narrow operational subset, but the architecture should not block later support for richer Telegram client capabilities.

If TDLib exposes a capability as a straightforward request, the client layer may include a thin wrapper for it. For example, a low-level `sendMessage` wrapper can exist without making sending part of the first product workflow.

## Non-Responsibilities

- Product-level interpretation of messages.
- Bulk attachment processing.
