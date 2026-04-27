# Component Boundaries

This document defines the boundaries needed for the first implementation.

## TDLib Sidecar

Owns:

- Telegram login and session state.
- TDLib local database.
- Receiving live Telegram updates.
- Fetching chat lists and historical messages.
- Exposing a small internal API for client commands.
- Passing raw Telegram facts to storage.
- Executing historical fetch jobs requested by the history sync domain.

Does not own:

- Product-level interpretation of messages.
- Bulk attachment processing.
- Long-running data analysis.

## Storage Layer

Owns:

- Postgres schema for raw events and current message state.
- Idempotent writes.
- Basic chat, user, message, reply, and attachment metadata.
- History templates, targets, coverage intervals, and backfill job state.

Does not own:

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
