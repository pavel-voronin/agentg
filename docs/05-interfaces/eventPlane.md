# Event Plane

## Purpose

NATS Core is the internal live event plane. It carries notifications that a
domain fact happened. It does not carry addressed reads, commands, or
request/reply RPC.

Internal reads and commands use module-owned procedures exposed through the
module framework RPC transport. Browser and external agent protocols are
separate edge protocols owned by Dashboard and Gateway.

## Envelope

Every event published to NATS uses the event envelope:

```json
{
  "id": "evt_...",
  "type": "telegram.history.coverage.changed",
  "at": "2026-05-01T00:00:00.000Z",
  "data": {}
}
```

- `type` is also the NATS subject.
- The first `type` segment names the publishing domain or component.
- `data` is owned by the publishing domain.

## Rules

- Events describe facts that happened.
- Events are live and non-durable.
- Events are not a replay log.
- Consumers must recover state through domain RPC or their own owned storage.
- NATS request/reply is not part of the architecture.
- Wildcard subscriptions are allowed for internal fan-out. External edge
  services must explicitly choose which events cross their boundary.

## NATS API Usage

Runtime code uses the event bus provided by `@agentg/framework` as the
NATS boundary. That boundary exposes only:

- `publish(type, data)`: publish an event on `type`.
- `subscribe(subject, handler)`: consume matching integration events.

It does not expose request/reply, responder, inbox, or service APIs. Source audit
after the current module migration found no runtime use of NATS request/reply
APIs in module-boundary modules.

## Current Subjects

Telegram publishes:

- `telegram.status`
- `telegram.login.started`
- `telegram.login.completed`
- `telegram.login.failed`
- `telegram.update.chat.discovered`
- `telegram.update.chat.directory.updated`
- `telegram.chat_folders.updated`
- `telegram.update.message.created`
- `telegram.update.message.updated`
- `telegram.update.message.deleted`
- `telegram.user.updated`
- `telegram.history.coverage.changed`
- `telegram.tdlib.{method}.started`
- `telegram.tdlib.{method}.completed`
- `telegram.tdlib.{method}.failed`

History Sync publishes:

- `history-sync.sync.requested`
- `history-sync.sync.accepted`
- `history-sync.sync.started`
- `history-sync.sync.completed`
- `history-sync.sync.skipped`
- `history-sync.sync.failed`
- `history-sync.target.upserted`
- `history-sync.target.deleted`
- `history-sync.target.auto_deleted`

Internal RPC calls are telemetry signals, not NATS facts. The HTTP RPC transport
records client and server spans and duration metrics. Modules publish NATS facts
explicitly when a domain state transition matters to other consumers.
Internal RPC transport, protocol, and domain procedure failures are part of the
module runtime contract, not event-plane state.

`history-sync.sync.requested` is a notification that a sync wake-up was accepted at
the History Sync boundary. It is not consumed as a NATS command.
`history-sync.sync.skipped` records a pass that found no local History Sync
demand and therefore did not call Telegram history or directory procedures.

## Consumers

History Sync subscribes to Telegram events:

- `telegram.update.chat.discovered` carries the discovered chat id in
  `data.args[0]` and wakes template materialization only for that chat.

History Sync removes concrete targets for chats no longer listed by Telegram
during explicit full reconciliation, not during every target-only pass.

Gateway subscribes only to `telegram.login.completed` and forwards that event to
external agent WebSocket clients. All other events remain internal unless a
Gateway API change explicitly exposes them.

Dashboard server subscribes to `>` and forwards live events to
browser clients.

Telegram event `data` embeds Telegram domain objects as inline ModelRefs.
Stable Telegram chat references use `{ "_model": "telegram.chat", "id": "..." }`.
Stable Telegram chat folder references use `{ "_model": "telegram.chatFolder",
"id": "..." }`.
Stable Telegram message references use `{ "_model": "telegram.message", "id":
"{chatId}:{messageId}" }` because TDLib message ids are scoped to a chat.

## Recovery Surfaces

After reconnecting, consumers must rebuild state through these surfaces:

- Gateway external clients: Gateway WebSocket RPC methods backed by Telegram
  procedures.
- Dashboard browser clients: Dashboard WebSocket RPC methods handled by
  Dashboard-owned backend procedures.
- History Sync: its own Postgres tables plus Telegram read and history-fetch
  module RPC.
- Telegram ingestion: TDLib session state and Telegram-shaped Postgres storage.
- Modules: their owned tables plus domain module RPC reads.

## Internal RPC Ownership

Internal procedure contracts are owned by the serving module package:

- Telegram owns `@agentg/telegram`, whose package root exports the typed client
  for its module procedure surface. The Telegram schemas, storage schema,
  ingestion, normalization, and TDLib plumbing remain package-internal.
- History Sync owns `@agentg/history-sync`, whose package root exports the typed
  client for its module procedure surface. The History Sync schemas, storage
  schema, commands, and domain types remain package-internal.
- Modules own package-local procedure contracts. Module schemas, storage schema,
  registrations, and runtime remain package-internal.

Gateway owns the external agent WebSocket protocol. Dashboard owns the
browser-facing WebSocket protocol. Neither protocol is an internal procedure
contract, and neither browser nor external agent clients call module procedures
directly.

There is no shared internal procedure contracts package. Cross-cutting module
runtime helpers live in `@agentg/framework`.

## Removed Command Subjects

These subjects are intentionally removed:

- `history-sync.target.upsert.requested`
- `history-sync.target.delete.requested`

Target changes now go through History Sync's module-owned procedures. History Sync
publishes `history-sync.target.upserted` and `history-sync.target.deleted` after the write.
