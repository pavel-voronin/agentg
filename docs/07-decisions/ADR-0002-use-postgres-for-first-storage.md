# ADR-0002: Use Postgres For First Storage

## Status

Accepted for the first implementation.

## Context

The first implementation needs durable storage, inspectable data, idempotent writes, and enough structure to verify Telegram synchronization. It does not need a separate event streaming system.

## Decision

Use Postgres for:

- raw Telegram event facts
- current message state
- chats and users
- attachment metadata
- History Sync templates and targets
- Telegram history coverage

## Consequences

Benefits:

- simple local development stack
- direct SQL inspection for the first acceptance checks
- natural fit for current message state and history coverage
- fewer moving parts while TDLib integration is still being proven

Trade-offs:

- if future storage requirements change, this decision can be revisited
