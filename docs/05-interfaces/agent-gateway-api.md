# Agent Gateway API

## Purpose

Agent Gateway is the external API boundary for an agent-side MCP plugin.

The plugin connects to Gateway over WebSocket. Gateway keeps NATS internal, applies the external protocol boundary, forwards live integration events, and serves small RPC-style read commands against Postgres.

Gateway is a separate workspace package at `packages/gateway`. Telegram ingestion
is a separate workspace package at `packages/telegram`.

## Runtime

```text
Telegram ingestion
  -> Postgres
  -> NATS Core subjects

Agent Gateway
  <- NATS Core subjects
  -> WebSocket clients
  -> Postgres read RPC
```

Start locally:

```sh
docker compose up -d postgres nats
npm run dev:telegram
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

Current subjects match event types:

- `telegram.chat.updated`
- `telegram.message.created`
- `telegram.message.updated`
- `telegram.message.deleted`

These events are live integration signals. They are not durable and are not a replay log. Reconnect recovery should use Gateway RPC methods backed by Postgres.

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
to the Telegram history-sync domain. Gateway delegates to
`@agentg/telegram/history-sync/observability` and does not own history range,
coverage, target, or job semantics.

`history.getOverview`

Returns chat, template, target, coverage, and job counters.

`history.listChats`

```json
{
  "query": "optional title or id filter",
  "limit": 200
}
```

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
Gateway does not write `history_targets` directly. It sends a NATS request on
`history.target.upsert.requested` and returns success only after the Telegram
history domain writes the target. Telegram also emits `history.target.upserted`
and wakes the reconciler in the same process.

`history.requestSync`

```json
{
  "chatId": "123"
}
```

`chatId` is optional. The command is sent through NATS and consumed by the
Telegram process when it is running.

The Telegram history-sync actor is event-driven and single-flight. Startup,
target changes, chat changes, and explicit sync requests wake it. If another
wake-up arrives during a run, it performs another pass after the current run.
There is no periodic polling loop.
