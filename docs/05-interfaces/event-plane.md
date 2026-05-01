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

Control Plane server subscribes to `telegram.>` and `history.>` and forwards
live events to browser clients.

## Recovery Surfaces

After reconnecting, consumers must rebuild state through these surfaces:

- Gateway external clients: Gateway WebSocket RPC methods backed by Postgres and
  History tRPC.
- Control Plane browser clients: Control Plane WebSocket RPC methods backed by
  History tRPC.
- History Sync: its own Postgres tables plus Telegram History tRPC.
- Telegram ingestion: TDLib session state and Telegram-shaped Postgres storage.

## Removed Command Subjects

These subjects are intentionally removed:

- `history.target.upsert.requested`
- `history.target.delete.requested`

Target changes now go through History Sync's domain-owned tRPC API. History Sync
publishes `history.target.upserted` and `history.target.deleted` after the write.
