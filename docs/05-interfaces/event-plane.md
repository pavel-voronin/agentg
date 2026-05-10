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
  "type": "telegram.history.coverage.changed",
  "occurredAt": "2026-05-01T00:00:00.000Z",
  "data": {},
  "meta": {}
}
```

- `type` is also the NATS subject.
- The first `type` segment names the publishing domain or component.
- `data` is owned by the publishing domain.
- `meta` is optional routing/debug metadata, not a read model.

## Rules

- Events describe facts that happened.
- Events are live and non-durable.
- Events are not a replay log.
- Consumers must recover state through domain RPC or their own owned storage.
- NATS request/reply is not part of the architecture.
- Wildcard subscriptions are allowed for internal fan-out. External edge
  services must explicitly choose which events cross their boundary.

## NATS API Usage

Runtime code uses `@agentg/events/bus` as the NATS boundary. That boundary
exposes only:

- `publish(event)`: publish an integration event on `event.type`.
- `subscribe(subject, handler)`: consume matching integration events.

It does not expose request/reply, responder, inbox, or service APIs. Source audit
after the tRPC migration found no runtime use of NATS request/reply APIs in
Telegram, History Sync, Gateway, Control Plane, `@agentg/events`, `@agentg/rpc`,
or `@agentg/infra`.

## Current Subjects

Telegram publishes:

- `telegram.status`
- `telegram.login.started`
- `telegram.login.completed`
- `telegram.login.failed`
- `telegram.chat.updated`
- `telegram.chat_folders.updated`
- `telegram.message.created`
- `telegram.message.updated`
- `telegram.message.deleted`
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
- `history-sync.sync.failed`
- `history-sync.target.upserted`
- `history-sync.target.deleted`
- `history-sync.target.auto_deleted`

RPC calls publish lifecycle events by default:

- `{domain}.rpc.{procedure}.started`
- `{domain}.rpc.{procedure}.progress`
- `{domain}.rpc.{procedure}.completed`
- `{domain}.rpc.{procedure}.failed`

For example, `history-sync.getChatHistorySyncState` publishes
`history-sync.rpc.getChatHistorySyncState.started`,
`history-sync.rpc.getChatHistorySyncState.progress`,
`history-sync.rpc.getChatHistorySyncState.completed`, and
`history-sync.rpc.getChatHistorySyncState.failed`.

`history-sync.sync.requested` is a notification that a sync wake-up was accepted at
the History Sync boundary. It is not consumed as a NATS command.

Service Directory publishes:

- `service_directory.changed`

`service_directory.changed` carries `{ version }` and is an invalidation signal
for local Service Directory clients. Consumers recover the actual topology by
calling Service Directory `getSnapshot`; the event body is not the topology.
If a refreshed snapshot has lost a previously seen `required: true` service, the
client treats it as a fatal topology failure and starts graceful shutdown.

## Consumers

History Sync subscribes to Telegram events:

- `telegram.chat.updated` wakes reconciliation because the known chat set may
  have changed.
- `telegram.chat.removed` removes concrete targets for chats no longer listed by
  Telegram.
- `telegram.history.coverage.changed` wakes sync so completed one-shot targets
  can be removed and remaining requested intervals can continue converging.

Gateway subscribes only to `telegram.login.completed` and forwards that event to
external agent WebSocket clients. All other events remain internal unless a
Gateway API change explicitly exposes them.

Control Plane server subscribes to `>` and forwards live integration events to
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
  internal tRPC.
- Control Plane browser clients: Control Plane WebSocket RPC methods resolved
  through Service Directory and forwarded to the owning internal tRPC service.
- History Sync: its own Postgres tables plus Telegram read and history-fetch
  tRPC.
- Telegram ingestion: TDLib session state and Telegram-shaped Postgres storage.
- Modules: their owned tables plus domain tRPC reads.
- Service Directory clients: their local snapshot plus Service Directory
  `getSnapshot` after `service_directory.changed`.

## Internal RPC Ownership

Internal RPC contracts are owned by the serving domain package:

- Telegram owns `@agentg/telegram/rpc`, whose only public export is
  `createTelegramRpcClient`. The helper returns the explicit Telegram
  procedures used by typed internal callers. The
  Telegram schemas, router, server bind config, storage schema, ingestion,
  normalization, and TDLib plumbing remain package-internal.
- History Sync owns `@agentg/history-sync/rpc`, whose only public export is
  `createHistorySyncRpcClient`. The helper returns the explicit History Sync procedures
  used by typed internal callers. The History Sync schemas, router, server bind config,
  storage schema, commands, and domain types remain package-internal.
- Modules own package-local RPC contracts. Module schemas, routers, server bind
  config, storage schema, registrations, and service runtime remain
  package-internal.

Gateway owns the external agent WebSocket protocol. Control Plane owns the
browser-facing WebSocket protocol. Neither protocol is an internal domain RPC
contract, and neither browser nor external agent clients call internal tRPC
directly.

There is no shared internal domain RPC contracts package. Cross-cutting helpers
are split by owner: `@agentg/events` owns the event bus, event envelope, and
JSON value helpers; `@agentg/rpc` owns RPC call lifecycle helpers and model
markers; `@agentg/infra` owns runtime config helpers.

## Removed Command Subjects

These subjects are intentionally removed:

- `history-sync.target.upsert.requested`
- `history-sync.target.delete.requested`

Target changes now go through History Sync's domain-owned tRPC API. History Sync
publishes `history-sync.target.upserted` and `history-sync.target.deleted` after the write.
