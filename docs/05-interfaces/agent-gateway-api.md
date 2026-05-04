# Agent Gateway API

## Purpose

Agent Gateway is the external API boundary for an agent-side MCP plugin.

The plugin connects to Gateway over WebSocket. Gateway keeps NATS internal,
applies the external protocol boundary, forwards live integration events, calls
Telegram through internal tRPC for Telegram reads, and calls History Sync through
internal tRPC for history commands and reads.

Gateway is a separate workspace package at `packages/gateway`. Telegram
ingestion is a separate workspace package at `packages/telegram`. History Sync
is a separate workspace package at `packages/history-sync`.

## Runtime

```text
Telegram ingestion
  -> Postgres
  -> NATS Core subjects

History Sync
  -> Postgres history tables
  <-> tRPC to Telegram ingestion

Agent Gateway
  <- NATS Core subjects
  -> WebSocket clients
  <-> tRPC to Telegram ingestion for Telegram reads
  <-> tRPC to History Sync
  <-> tRPC to module services for registered capabilities
  <-> tRPC to Extension Registry for extension registrations
  <-> tRPC to extension services for caller-composed views
```

Start locally:

```sh
docker compose up -d postgres nats
npm run dev:telegram
npm run dev:history-sync
npm run dev:gateway
```

History observability page:

```text
http://127.0.0.1:8787/history
```

Start Gateway from Docker:

```sh
docker compose --profile gateway up gateway
```

Configuration:

- `NATS_URL`, default `nats://localhost:4222`
- `AGENT_GATEWAY_HOST`, default `127.0.0.1`
- `AGENT_GATEWAY_PORT`, default `8787`
- `AGENT_GATEWAY_TOKEN`, optional query-string token
- `TELEGRAM_RPC_URL`, default `http://127.0.0.1:18081`
- `HISTORY_RPC_URL`, default `http://127.0.0.1:18082`
- `EXTENSION_REGISTRY_RPC_URL`, optional registry URL for `extensions.compose`
- `SUMMARIES_RPC_URL`, optional Summaries service URL for
  `summaries.*` extension getters

When `AGENT_GATEWAY_TOKEN` is set, connect with:

```text
ws://127.0.0.1:8787/?token=...
```

## Event Envelope

Gateway notifications use the integration event envelope:

```json
{
  "event": {
    "id": "evt_...",
    "type": "telegram.message.created",
    "source": "telegram",
    "occurredAt": "2026-04-26T10:00:00.000Z",
    "data": {},
    "meta": {}
  }
}
```

The envelope is stable. `data` remains JSON and intentionally does not require a schema registry.

## NATS Subjects

Gateway does not use NATS request/reply. It subscribes to live event subjects and
forwards matching events to external WebSocket clients.

Current event-plane subjects are documented in
[Event Plane](event-plane.md).

These events are live integration signals. They are not durable and are not a
replay log. Reconnect recovery should use Gateway RPC methods backed by Postgres
and History tRPC.

## RPC Protocol

Client requests are JSON objects:

```json
{
  "id": "req_1",
  "method": "telegram.listRecentMessages",
  "params": {
    "limit": 20
  }
}
```

Responses:

```json
{
  "id": "req_1",
  "result": {}
}
```

Errors:

```json
{
  "id": "req_1",
  "error": {
    "code": "method_failed",
    "message": "Unknown method: example"
  }
}
```

## Methods

Gateway owns these external WebSocket method names. Telegram owns the internal
read models that back the `telegram.*` methods. Gateway does not return Telegram
database rows or raw TDLib payloads.

`telegram.getMessage`

```json
{
  "chatId": "123",
  "messageId": "456"
}
```

`telegram.listRecentMessages`

```json
{
  "chatId": "123",
  "limit": 50
}
```

`chatId` is optional. `limit` defaults to `50` and is capped at `200`.

`telegram.searchMessages`

```json
{
  "query": "invoice",
  "chatId": "123",
  "limit": 20
}
```

`chatId` is optional. `limit` defaults to `20` and is capped at `100`.

`telegram.getChat`

```json
{
  "chatId": "123"
}
```

## History Observability Methods

Gateway exposes these methods over WebSocket, but the API implementation belongs
to the History Sync domain. Gateway sends `history.*` methods to History Sync's
internal tRPC API and does not own history range, coverage, target, or job
semantics.

`history.getOverview`

Returns template, target, coverage, and job counters. Chat directory counts are
not History-owned.

`history.getChatStats`

```json
{
  "chatIds": ["123", "456"]
}
```

Returns History-owned counters keyed by Telegram chat id. It does not return
Telegram chat titles, folders, list placement, or navigation.

`history.getChatHistoryState`

```json
{
  "chatId": "123"
}
```

Returns the selected chat, targets, projected desired intervals, coverage,
missing intervals, and jobs.

`history.upsertTarget`

```json
{
  "chatId": "123",
  "preset": "last30d"
}
```

Supported presets are `last7d`, `last30d`, and `full`. A custom target can use
`start` and `end` strings such as `past`, `now-30d`, `now`, or an absolute date.
Gateway does not write `history_targets` directly. It calls History Sync over
tRPC and returns success only after the History Sync process writes the target.
History Sync also emits `history.target.upserted` and wakes its reconciler.

`history.requestSync`

```json
{
  "chatId": "123"
}
```

`chatId` is optional. Gateway calls History Sync through internal tRPC. History
Sync wakes its own controller in-process and may publish
`history.sync.requested` as a live notification event.

The History Sync actor is event-driven and single-flight. Startup,
target changes, chat changes, and explicit sync requests wake it. If another
wake-up arrives during a run, it performs another pass after the current run.
There is no periodic polling loop.

## Capability Methods

Gateway keeps an in-memory registry of active module capabilities. Capability
registrations are ephemeral: modules register at startup and refresh their
records periodically.

`capabilities.register`

```json
{
  "moduleSlug": "summaries",
  "name": "summaries.requestChatSummary",
  "serviceUrl": "http://summaries:8080",
  "rpcMethod": "summaries.requestSummary",
  "rpcType": "mutation",
  "description": "Request or refresh a deterministic chat summary"
}
```

`name` must be prefixed by `moduleSlug`. `rpcType` is `query` or `mutation` and
defaults to `query`.

`capabilities.list`

Returns active capability registrations:

```json
{
  "capabilities": [
    {
      "moduleSlug": "summaries",
      "name": "summaries.requestChatSummary",
      "serviceUrl": "http://summaries:8080",
      "rpcMethod": "summaries.requestSummary",
      "rpcType": "mutation",
      "registeredAt": "2026-05-02T00:00:00.000Z",
      "expiresAt": "2026-05-02T00:01:00.000Z"
    }
  ]
}
```

`capabilities.call`

```json
{
  "name": "summaries.requestChatSummary",
  "input": {
    "chatId": "123",
    "reason": "agent-request",
    "sourceMessages": []
  }
}
```

Gateway routes the call to the owning module tRPC method and returns the direct
result to the WebSocket client.

Gateway does not persist capability registrations. Modules refresh active
registrations periodically, and Gateway removes stale entries when listing or
resolving capabilities.

## Extension Composition

Gateway can compose an extended view when it is configured with
`EXTENSION_REGISTRY_RPC_URL` and the required extension service URLs.

`extensions.compose`

```json
{
  "method": "telegram.getChat",
  "params": {
    "chatId": "123"
  }
}
```

Gateway calls the base method first, scans the returned body for objects with
`_model` and `id`, asks Extension Registry for getters registered against each
`_model`, calls those getter RPC methods, and returns a caller-composed view:

```json
{
  "base": {
    "chat": {
      "_model": "telegram.chat",
      "id": "123",
      "title": "Saved Messages",
      "type": "private"
    }
  },
  "extensions": [
    {
      "extension": "summaries.chatSummary",
      "model": {
        "_model": "telegram.chat",
        "id": "123"
      },
      "result": {
        "summary": null,
        "stale": false,
        "invalidation": null
      }
    }
  ]
}
```

Extension Registry itself exposes `registerExtension` and `listExtensions`
through internal tRPC. It stores `{ target, extension }` entries only; it does
not invoke extension RPC methods or perform service discovery.

## Telegram History RPC

History Sync talks to Telegram ingestion through a narrow internal tRPC surface.
History jobs are not exposed to Telegram ingestion.

- `listChats`: optionally asks Telegram ingestion to discover chats through
  TDLib and returns Telegram-shaped chat metadata.
- `fetchPage`: asks Telegram ingestion to fetch and persist one history page for
  `{ chatId, startAt, endAt, cursorMessageId, limit }`. The response is a
  compact page summary used by History Sync to checkpoint its own backfill job
  and coverage state.
