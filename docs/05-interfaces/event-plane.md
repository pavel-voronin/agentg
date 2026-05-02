# Event Plane

## Purpose

NATS Core is the internal live event plane. It carries notifications that a
domain fact happened. It does not carry addressed reads, commands, or
request/reply RPC.

Internal reads and commands use domain-owned tRPC APIs. Browser and external
agent protocols are separate edge protocols owned by Control Plane and Gateway.

## Envelope

Every event published to NATS uses the integration event envelope:

```json
{
  "id": "evt_...",
  "type": "history.coverage.changed",
  "source": "history-sync",
  "occurredAt": "2026-05-01T00:00:00.000Z",
  "data": {},
  "meta": {}
}
```

- `type` is also the NATS subject.
- `source` names the publishing domain or component.
- `data` is owned by the publishing domain.
- `meta` is optional routing/debug metadata, not a read model.

## Rules

- Events describe facts that happened.
- Events are live and non-durable.
- Events are not a replay log.
- Consumers must recover state through domain RPC or their own owned storage.
- NATS request/reply is not part of the architecture.
- Wildcard subscriptions are allowed for fan-out, for example `telegram.>` and
  `history.>`.

## NATS API Usage

Runtime code uses `@agentg/shared/events/bus` as the NATS boundary. That boundary
exposes only:

- `publish(event)`: publish an integration event on `event.type`.
- `subscribe(subject, handler)`: consume matching integration events.

It does not expose request/reply, responder, inbox, or service APIs. Source audit
after the tRPC migration found no runtime use of NATS request/reply APIs in
Telegram, History Sync, Gateway, Control Plane, or Shared.

## Current Subjects

Telegram publishes:

- `telegram.tdlib.status`
- `telegram.chat.updated`
- `telegram.chat_folders.updated`
- `telegram.message.created`
- `telegram.message.updated`
- `telegram.message.deleted`

History Sync publishes:

- `history.sync.requested`
- `history.sync.accepted`
- `history.sync.started`
- `history.sync.completed`
- `history.sync.failed`
- `history.reconcile.completed`
- `history.job.started`
- `history.job.progress`
- `history.job.completed`
- `history.job.failed`
- `history.coverage.changed`
- `history.target.upserted`
- `history.target.deleted`
- `history.target.auto_deleted`

Summaries publishes:

- `summaries.summary.requested`
- `summaries.summary.completed`
- `summaries.summary.invalidated`

Observable RPC calls publish:

- `{target}.started`
- `{target}.progress`
- `{target}.completed`
- `{target}.failed`

For example, `history.getChatHistoryState` publishes
`history.getChatHistoryState.started`,
`history.getChatHistoryState.progress`,
`history.getChatHistoryState.completed`, and
`history.getChatHistoryState.failed`.

`history.sync.requested` is a notification that a sync wake-up was accepted at
the History boundary. It is not consumed as a NATS command.

## Consumers

History Sync subscribes to Telegram events:

- `telegram.chat.updated` wakes reconciliation because the known chat set may
  have changed.
- `telegram.message.created` updates live coverage for message-history updates.
- `telegram.tdlib.status` opens and closes the live coverage session.

Gateway subscribes to `telegram.>` and `history.>` and forwards live events to
external agent WebSocket clients.

Control Plane server subscribes to `>` and forwards live integration events to
browser clients.

Summaries subscribes to Telegram message events and History state-change events
to invalidate private summary state. It recovers durable state through
`summaries_*` tables and does not treat NATS as a replay log.

## Recovery Surfaces

After reconnecting, consumers must rebuild state through these surfaces:

- Gateway external clients: Gateway WebSocket RPC methods backed by Telegram and
  History internal tRPC.
- Control Plane browser clients: Control Plane WebSocket RPC methods backed by
  History tRPC.
- History Sync: its own Postgres tables plus Telegram read and history-fetch
  tRPC.
- Telegram ingestion: TDLib session state and Telegram-shaped Postgres storage.
- Modules: their owned tables plus domain tRPC reads.

## Internal RPC Ownership

Internal RPC contracts are owned by the serving domain package:

- Telegram owns `@agentg/telegram/rpc`, including the Telegram History tRPC
  router and schemas for `listChats`, `fetchPage`, Gateway Telegram reads, and
  the stable Telegram read facts consumed by History Sync.
- History Sync owns `@agentg/history-sync/rpc`, including the History tRPC router,
  schemas, and the JSON-RPC adapter used by Gateway and Control Plane server for
  existing `history.*` method names.
- Modules own package-local RPC contracts. The pilot summaries module owns
  `@agentg/summaries/rpc` and registers its capability and extension methods
  through the module runtime.

Gateway owns the external agent WebSocket protocol. Control Plane owns the
browser-facing WebSocket protocol. Neither protocol is an internal domain RPC
contract, and neither browser nor external agent clients call internal tRPC
directly.

There is no shared internal domain RPC contracts package. `@agentg/shared` owns
only cross-cutting helpers such as the event envelope, event bus abstraction,
standard RPC envelope, call lifecycle events, capability contracts, extension
contracts, and module runtime helpers.

## Removed Command Subjects

These subjects are intentionally removed:

- `history.target.upsert.requested`
- `history.target.delete.requested`

Target changes now go through History Sync's domain-owned tRPC API. History Sync
publishes `history.target.upserted` and `history.target.deleted` after the write.
