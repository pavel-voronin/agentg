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
- `telegram.messages.ready`
- `telegram.messages.failed`
- `telegram.history.reconciler.queueChanged`
- `telegram.message.created`
- `telegram.message.updated`
- `telegram.message.deleted`
- `telegram.files.ownerChanged`
- `telegram.files.queueChanged`

The Telegram module defines its event-bus publication surface in
`packages/telegram/src/events.ts`. TDLib updates and TDLib operation lifecycle
details are private Telegram implementation details and are not event-plane
subjects.

Internal RPC calls are telemetry signals, not NATS facts. The HTTP RPC transport
records client and server spans and duration metrics. Modules publish NATS facts
explicitly when a domain state transition matters to other consumers.
Internal RPC transport, protocol, and domain procedure failures are part of the
module runtime contract, not event-plane state.

## Consumers

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
- Telegram ingestion: TDLib session state and Telegram-shaped Postgres storage.
- Modules: their owned tables plus domain module RPC reads.

## Internal RPC Ownership

Internal procedure contracts are owned by the serving module package:

- Telegram owns `@agentg/telegram`, whose package root exports the typed client
  for its domain procedure surface. The Telegram schemas, storage schema,
  ingestion, normalization, coverage mechanics, file materialization, and TDLib
  plumbing remain package-internal. Its public procedures must not expose raw
  TDLib calls, page fetches, cursors, or lower-level materialization controls.
- Modules own package-local procedure contracts. Module schemas, storage schema,
  registrations, and runtime remain package-internal.

Gateway owns the external agent WebSocket protocol. Dashboard owns the
browser-facing WebSocket protocol. Neither protocol is an internal procedure
contract, and neither browser nor external agent clients call module procedures
directly.

There is no shared internal procedure contracts package. Cross-cutting module
runtime helpers live in `@agentg/framework`.
